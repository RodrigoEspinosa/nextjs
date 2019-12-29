const pagesManifest = require('./pages-manifest.json')
const routesManifest = require('./routes-manifest.json')
const cloudFrontCompat = require('./next-aws-cloudfront')

// Get a list of all the dynamic routes.
const DYNAMIC_ROUTES = routesManifest.dynamicRoutes || []

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
const getPage = (path) => {
  // Check if the path is dynamic.
  const dynamicRoute = DYNAMIC_ROUTES.find(({ regex }) => path.match(regex))

  // Get the path to the page.
  const page = dynamicRoute ? pagesManifest[dynamicRoute.page] : pagesManifest[path]

  return require(`./${page}`)
}

module.exports.handler = async (event) => {
  const request = event.Records[0].cf.request

  const path = getPath(request)

  const page = getPage(path)

  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf)

  page.render(req, res)

  return responsePromise
}
