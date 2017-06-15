'use strict'

module.exports = {
  'removal': [
    'AWS::Lambda::Permission',
    'AWS::ApiGateway::Deployment',
    'AWS::Lambda::Version'
  ],
  'passthrough': [

  ]
}