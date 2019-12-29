const path = require('path')
const getDotNextDirectory = require('./get-dot-next-directory')

const getStaticDirectory = (inputs) =>
  path.normalize(path.join(getDotNextDirectory(inputs), '..', 'static'))

module.exports = getStaticDirectory
