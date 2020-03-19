const path = require('path')
const util = require('util')
const fs = require('fs').promises
const { getPolicy } = require('./utils')
const types = require('./serverless.types.js')
const exec = util.promisify(require('child_process').exec)
const { Component, utils } = require('@serverless/core')

const getServerlessDirectory = (inputs) => inputs.code.src

const getDotNextDirectory = (inputs) =>
  path.normalize(path.join(getServerlessDirectory(inputs), '..'))

const getStaticDirectory = (inputs) =>
  path.normalize(path.join(getDotNextDirectory(inputs), '..', 'public'))

/**
 * Nextjs
 */

class Nextjs extends Component {
  /**
   * Types
   */

  types() {
    return types
  }

  getBucketName(inputs = {}) {
    return inputs.bucketName || this.state.bucketName || `website-${this.context.resourceId()}`
  }

  async default(inputs = {}) {
    this.context.status('Deploying')
    this.context.debug(`Starting Next.js Component.`)

    const domain = await this.load('@serverless/domain')
    const role = await this.load('@serverless/aws-iam-role')
    const cloudFront = await this.load('@serverless/aws-cloudfront')
    const websiteBucket = await this.load('@serverless/aws-s3', 'websiteBucket')
    const defaultLambda = await this.load('@serverless/aws-lambda', 'defaultLambda')

    // Default to current working directory.
    inputs.code = inputs.code || {}

    // Get the code root.
    inputs.code.root = inputs.code.root ? path.resolve(inputs.code.root) : process.cwd()

    // Get the code source.
    if (inputs.code.src) {
      inputs.code.src = path.join(inputs.code.root, inputs.code.src)
    }

    // Get the region.
    inputs.region = inputs.region || 'us-east-1'

    // Get the bucket name.
    inputs.bucketName = this.getBucketName(inputs)

    this.context.status(`Preparing AWS S3 Bucket`)
    this.context.debug(`Preparing website AWS S3 bucket ${inputs.bucketName}.`)

    const bucketOutputs = await websiteBucket({
      name: inputs.bucketName,
      accelerated: false,
      region: inputs.region
    })

    this.state.bucketName = inputs.bucketName
    await this.save()

    // If a hook is provided, build the website
    if (inputs.code.hook) {
      this.context.status('Building assets')
      this.context.debug(`Running ${inputs.code.hook} in ${inputs.code.root}.`)

      const options = {
        cwd: inputs.code.root,
        env: { ...process.env, ...inputs.env }
      }
      try {
        await exec(inputs.code.hook, options)
      } catch (err) {
        console.error(err.stderr) // eslint-disable-line
        throw new Error(
          `Failed building next.js app via "${inputs.code.hook}" due to the following error: "${err.stderr}"`
        )
      }
    }

    // Copy the `routes-manifest.json` to the serverless directory.
    await fs.copyFile(
      `${inputs.code.src}/../routes-manifest.json`,
      `${inputs.code.src}/routes-manifest.json`
    )

    // S3 Upload

    this.context.status('Uploading')

    const dirToUploadPath = inputs.code.src || inputs.code.root

    // Uploads `/public` directory to S3
    const staticDirToUploadPath = getStaticDirectory(inputs)
    this.context.debug(
      `Uploading website public files from ${dirToUploadPath} to bucket ${bucketOutputs.name}.`
    )

    await websiteBucket.upload({ dir: staticDirToUploadPath })

    // Uploads `/.next/static` directory to S3
    const dotNextDirectory = getDotNextDirectory(inputs)
    const staticNextDirToUploadPath = path.join(dotNextDirectory, 'static')
    this.context.debug(
      `Uploading website static files from ${staticNextDirToUploadPath} to bucket ${bucketOutputs.name}.`
    )

    await websiteBucket.upload({
      dir: staticNextDirToUploadPath,
      keyPrefix: '_next/static'
    })

    this.state.bucketName = inputs.bucketName
    this.state.region = inputs.region
    // this.state.url = `http://${bucketOutputs.name}.s3-website-${inputs.region}.amazonaws.com`
    await this.save()

    // IAM Roles

    this.context.status('Deploying AWS IAM Role')

    const roleInputs = {
      name: 'nextjs-' + this.context.resourceId(),
      region: inputs.region,
      service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
      policy: getPolicy(inputs.permissions)
    }

    const roleOutputs = await role(roleInputs)

    // LAMBDA

    this.context.status('Deploying AWS Lambda & Uploading Code')
    const lambdaInputs = {
      name: 'nextjs-' + this.context.resourceId(),
      description: inputs.description || 'A function for the Next.js Component',
      memory: inputs.memory || 896,
      timeout: inputs.timeout || 10,
      runtime: 'nodejs12.x',
      code: inputs.code.src || inputs.code.root,

      // role: roleOutputs,
      role: {
        service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'],
        policy: {
          arn: 'arn:aws:iam::aws:policy/AdministratorAccess'
        }
      },

      handler: 'shim.handler',
      shims: [path.join(__dirname, 'shim.js'), path.join(__dirname, 'next-aws-cloudfront.js')],
      // env: inputs.env || {},
      bucket: bucketOutputs.name,
      region: inputs.region
    }
    const lambdaOutputs = await defaultLambda(lambdaInputs)

    const lambdaAtEdgePublishOutputs = await defaultLambda.publishVersion()

    // Cloudfront

    const bucketUrl = `http://${bucketOutputs.name}.s3.amazonaws.com`
    const cloudFrontOrigins = [
      {
        url: bucketUrl,
        private: true,
        pathPatterns: {
          '_next/*': {
            ttl: 86400
          },
          'static/*': {
            ttl: 86400
          },
          '*.*': {
            ttl: 86400
          }
        }
      }
    ]

    const cloudFrontOutputs = await cloudFront({
      defaults: {
        ttl: 5,
        allowedHttpMethods: ['HEAD', 'GET'],
        cookies: 'all',
        queryString: true,
        'lambda@edge': {
          'origin-request': `${lambdaOutputs.arn}:${lambdaAtEdgePublishOutputs.version}`
        }
      },
      origins: cloudFrontOrigins
    })

    const outputs = {}

    // Configure custom domain, if specified
    if (inputs.domain) {
      const subdomain = inputs.domain.split('.')[0]
      const secondLevelDomain = inputs.domain.replace(`${subdomain}.`, '')

      const domainInputs = {
        domain: secondLevelDomain,
        subdomains: {}
      }

      domainInputs.subdomains[subdomain] = cloudFrontOutputs
      const domainOutputs = await domain(domainInputs)

      outputs.domain = domainOutputs.domains[0]
      this.state.domain = outputs.domain

      this.state.url = cloudFrontOutputs.url
      this.state.domain = cloudFrontOutputs.domain
      await this.save()
    }

    this.context.debug(`Next.js app deployed successfully to URL: ${this.state.url}.`)

    return {
      url: this.state.url,
      env: inputs.env || {},
      domain: outputs.domain
    }
  }

  /**
   * Remove
   */

  async remove() {
    this.context.status(`Removing`)

    this.context.debug(`Starting Website Removal.`)
    this.context.debug(`Removing Website bucket.`)
    const websiteBucket = await this.load('@serverless/aws-s3', 'websiteBucket')
    await websiteBucket.remove()

    // Remove custom domain, if specified
    if (this.state.domain) {
      this.context.debug(`Removing custom domain.`)
      const domain = await this.load('@serverless/domain')
      await domain.remove()
    }

    this.state = {}
    await this.save()

    this.context.debug(`Finished Website Removal.`)
    return {}
  }
}

module.exports = Nextjs
