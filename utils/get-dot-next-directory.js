const path = require('path')
const getServerlessDirectory = require('./get-serverless-directory')

const getDotNextDirectory = (inputs) =>
  path.normalize(path.join(getServerlessDirectory(inputs), '..'))

module.exports = getDotNextDirectory
