const { utils } = require('@serverless/core')

const getPolicy = (permissions) => {
  if (permissions === 'admin') {
    // user explicitly specified admin permissions
    return {
      arn: 'arn:aws:iam::aws:policy/AdministratorAccess'
    }
  } else if (permissions && permissions.length !== 'undefined') {
    // user specified their own simple permissions
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Action: permissions,
          Effect: 'Allow',
          Resource: '*'
        }
      ]
    }
  } else if (typeof permissions === 'object') {
    // user specified their own policy
    return permissions
  }

  // by default return a policy with access to only dynamodb & logs
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Action: ['dynamodb:*', 'logs:*'],
        Effect: 'Allow',
        Resource: '*'
      }
    ]
  }
}

const configureBucketForHosting = async (s3, bucketName) => {
  const s3BucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: {
          AWS: '*'
        },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/*`]
      }
    ]
  }
  const staticHostParams = {
    Bucket: bucketName,
    WebsiteConfiguration: {
      ErrorDocument: {
        Key: 'index.html'
      },
      IndexDocument: {
        Suffix: 'index.html'
      }
    }
  }

  const putPostDeleteHeadRule = {
    AllowedMethods: ['PUT', 'POST', 'DELETE', 'HEAD'],
    AllowedOrigins: ['https://*.amazonaws.com'],
    AllowedHeaders: ['*'],
    MaxAgeSeconds: 0
  }
  const getRule = {
    AllowedMethods: ['GET'],
    AllowedOrigins: ['*'],
    AllowedHeaders: ['*'],
    MaxAgeSeconds: 0
  }

  try {
    await s3
      .putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(s3BucketPolicy)
      })
      .promise()

    await s3
      .putBucketCors({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [putPostDeleteHeadRule, getRule]
        }
      })
      .promise()

    await s3.putBucketWebsite(staticHostParams).promise()
  } catch (e) {
    if (e.code === 'NoSuchBucket') {
      await utils.sleep(2000)
      return configureBucketForHosting(s3, bucketName)
    }
    throw e
  }
}

module.exports = {
  getPolicy,
  configureBucketForHosting
}
