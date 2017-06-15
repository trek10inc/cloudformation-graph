'use strict';

const path = require('path'),
  fs = require('fs'),
  BbPromise = require('bluebird'),
  lib = require('./lib'),
  _ = require('lodash'),
  isJSON = require('is-valid-json');

class CloudFormationGraph {
  constructor(options) {
    this.options = {
      horizontal: true,
      edgelabels: false
    };

    _.merge(this.options, options)
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

    // If JSON string and valid, pass right through
    if (isJSON(incomingStringOrFile)) {
      template = JSON.parse(incomingStringOrFile);
    }

    // If valid yaml, pull to template object
    if (!template) {
      try {
        template = YAML.parse(incomingStringOrFile);
      } catch (e) {
        // If we get here, we have totally bombed out, fail
        console.log('Failed to succesfully parse the template as JSON or YAML.');
        return;
      }
    }

    var obj = lib.extractGraph(template.Description, template.Resources)
    var graph = obj.graph;
    graph.edges = graph.edges.concat(obj.edges);
    lib.handleTerminals(template, graph, 'Parameters', 'source')
    return lib.renderGraph(graph, options)
  }
}

module.exports = CloudFormationGraph;
