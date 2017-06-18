'use strict';

const path      = require('path');
const fs        = require('fs');
const BbPromise = require('bluebird');
const lib       = require('./lib');
const yaml      = require('js-yaml');
const schema    = require('cloudformation-schema-js-yaml');

class CloudFormationGraph {
  constructor(options) {
    this.options = {
      horizontal: true,
      clarity: false,
      edgelabels: false
    };

    Object.assign(this.options, options)
    // this.commands = {
    //   graph: {
    //     usage: "Creates graphviz compatible graph output of nodes and edges. Saves to graph.out file.",
    //     lifecycleEvents: [
    //       'graph',
    //     ],
    //     options: {
    //       horizontal: {
    //         usage: 'Graph nodes from left to right instead of top down.'
    //       },
    //       edgelabels: {
    //         usage: 'Display edgelabels in graph.',
    //         shortcut: 'e',
    //       }
    //     }
    //   }
    // };
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

    // JSON is yaml, just use yaml
    try {
      template = yaml.safeLoad(incomingStringOrFile, {schema: schema });
      if (template === incomingStringOrFile) {
        throw new Error('Input is just a string')
      }
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
