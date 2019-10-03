const pagesManifest = require('./pages-manifest.json')
const cloudFrontCompat = require('./next-aws-cloudfront')

/**
 * Get the path for the event.
 *
 * @param  {Object} event
 * @param  {String} event.path
 * @return {String}
 */
const getPath = ({ uri }) => (uri === '/' ? '/index' : uri)

/**
 * Get the page for the specified path.
 *
 * @param  {String} path
 * @return {Object}
 */
const getPage = (path) => require(`./${pagesManifest[path]}`)

module.exports.handler = async (event) => {
  console.log('event', event)

  const request = event.Records[0].cf.request

  console.log('request', request)

  const path = getPath(request)

  console.log('current path', path)

  const page = getPage(path)

  console.log('current page', page)

  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf)

  page.render(req, res)

  return responsePromise

  // const response = await page.renderReqToHTML(req, res)

  // return {
  //   statusCode: 200,
  //   headers: {
  //     'content-type': 'text/html'
  //   },
  //   body: response
  // }
}
