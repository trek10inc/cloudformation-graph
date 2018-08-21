'use strict';

const path = require('path'),
  fs = require('fs'),
  lib = require('./lib'),
  _ = require('lodash'),
  yaml = require('js-yaml'),
  schema = require('cloudformation-schema-js-yaml');

class CloudFormationGraph {
  constructor(options) {
    this.options = {
      horizontal: true,
      clarity: false,
      edgelabels: false
    };

    _.merge(this.options, options)
  }

  graph(incomingStringOrFile) {
    const currentDir = process.cwd();
    let options = this.options;
    let template;

    // if we got a valid ABSOLUTE file path, read to incomingStringOrFile
    if (fs.existsSync(incomingStringOrFile)) {
      incomingStringOrFile = fs.readFileSync(incomingStringOrFile, 'utf8');
    }

    // if we got a valid relative file path, read to incomingStringOrFile
    if (fs.existsSync(`${process.cwd()}/${incomingStringOrFile}`)) {
      incomingStringOrFile = fs.readFileSync(`${process.cwd()}/${incomingStringOrFile}`, 'utf8');
    }

    // If valid yaml, pull to template object, JSON is yaml so just use yaml parser
    try {
      template = yaml.safeLoad(incomingStringOrFile, { schema });
    } catch (e) {
      // If we get here, we have totally bombed out, fail
      console.log('Failed to succesfully parse the template as JSON or YAML.');
      return;
    }

    var obj = lib.extractGraph(template.Description, template.Resources)
    var graph = obj.graph;
    graph.edges = graph.edges.concat(obj.edges);
    lib.handleTerminals(template, graph, 'Parameters', 'source')
    return lib.renderGraph(graph, options)
  }
}

module.exports = CloudFormationGraph;
