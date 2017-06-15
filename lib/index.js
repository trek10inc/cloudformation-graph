'use strict';

const iconMap = require('./iconMap'),
  noiseMap = require('./noiseMap'),
  _ = require('lodash'),
  path = require('path'),
  fs = require('fs');

const subRegex = new RegExp('\\${^!(.*?)}', 'g')
const iconPath = path.resolve(__dirname, '../lib/icons')
const defaultIcon = 'default.png'

var lib = {

  extractGraph: function (name, elem) {
    var graph = {
      name: name,
      nodes: [],
      edges: [],
      subgraphs: []
    }
    var edges = []

    Object.keys(elem).forEach(function (key) {
      graph.nodes.push({ name: key, data: elem[key] });
      edges = edges.concat(_.flattenDeep(lib.findRefs(key, elem[key])))
    });

    return { graph: graph, edges: edges };
  },

  findRefs: function (key, elem, properties = undefined, parentKey = undefined) {
    if (Array.isArray(elem)) {
      return elem.map(function (e) {
        return lib.findRefs(key, e)
      });
    }
    else if (typeof (elem) === 'string') return [];
    else if (Number.isInteger(elem)) return [];
    else if (typeof (elem) === 'boolean') return [];
    else if (typeof (elem) === 'object') {
      var refs = [];

      Object.keys(elem).forEach(function (k) {
        if (k === 'Ref') {
          if (!elem[k].startsWith('AWS::')) {
            refs.push({ 'from': elem[k], 'to': key, 'label': parentKey });
          }
        } else if (k === 'Fn::GetAtt') {
          refs.push({ 'from': elem[k][0], 'to': key, 'label': parentKey });
        } else if (k === 'Fn::Sub' && typeof (elem[k]) === 'string') {
          let subs = []
          let match
          while (match = subRegex.exec(elem[k])) {
            subs.push(match)
          }
          subs.map(m => {
            if (!m[1].startsWith('AWS::')) {
              refs.push({ 'from': m[1].split('.')[0], 'to': key, 'label': parentKey })
            }
          })
        } else {
          if (k == 'Properties') {
            properties = elem[k];
          }
          if (properties && properties[k]) {
            parentKey = k;
          }
          refs = refs.concat(lib.findRefs(key, elem[k], properties, parentKey));
        }
      });
      return refs;
    }
    else throw new Error("Unexpected type");
  },

  handleTerminals: function (template, graph, name, rank) {
    if (name in template) {
      var obj = lib.extractGraph(name, template[name]);
      obj.graph['rank'] = rank;
      obj.graph['style'] = 'filled,rounded';
      graph['subgraphs'].push(obj.graph);
      graph['edges'] = graph['edges'].concat(obj.edges);
    }
  },

  deDupeEdges: function (graph) {
    var edges = graph.edges;
    for (var i = 0; i < edges.length; i++) {
      for (var j = i + 1; j < edges.length; j++) {
        if (edges[i].to === edges[j].to && edges[i].from === edges[j].from) {
          var index = edges.indexOf(edges[j]);
          edges.splice(index, 1);
        }
      }
    }

    graph.edges = edges;
    return graph;
  },


  filterNoise: function (graph) {
    // filter via noiseMap
    var filteredNodes = [];
    var nestedAPIGResources = [];
    var nodes = graph.nodes;
    for (var i = nodes.length - 1; i >= 0; i -= 1) {
      // serverless deployment bucket removal
      var index = nodes.indexOf(nodes[i]);
      if (nodes[i].name === 'ServerlessDeploymentBucket') {
        filteredNodes.push(nodes[i].name);
        nodes.splice(index, 1);
      }

      // If filtered type, filter node and store so we can rip out edges too
      if (_.includes(noiseMap.removal, nodes[i].data.Type)) {
        filteredNodes.push(nodes[i].name);
        nodes.splice(index, 1);
      }

      // Know if we have a nested APIG resource
      if (_.includes(['AWS::ApiGateway::Resource', 'AWS::ApiGateway::Method'], nodes[i].data.Type)) {
        // check if we are directly hitting the parent or if we are a nested resource
        if (_.keys(nodes[i].data.Properties.ParentId)[0] !== 'Fn::GetAtt') {
          console.error(_.keys(nodes[i].data.Properties.ParentId))
          nestedAPIGResources.push(nodes[i].name)
        }
      }
    };
    graph.nodes = nodes;


    // Remove unnecessary edges now
    var edges = graph.edges;
    for (i = edges.length - 1; i >= 0; i -= 1) {
      var index = edges.indexOf(edges[i]);
      if (_.includes(filteredNodes, edges[i].to) || _.includes(filteredNodes, edges[i].from)) {
        edges.splice(index, 1);
      }

      // remove unnecessary edge to restAPI from nested apig resources
      // (remove unless parent id is a GetAtt)
      if (_.includes(nestedAPIGResources, edges[i].to) && edges[i].from === 'ApiGatewayRestApi') {
        edges.splice(index, 1);
      }
    }
    graph.edges = edges;

    return graph;
  },

  renderGraph: function (graph, options, subgraph = false) {
    return lib.writeGraph(graph, subgraph, options)
  },

  writeGraph: function (graph, subgraph, options) {
    let output = []
    if (options.clarity) graph = lib.filterNoise(graph)
    graph = lib.deDupeEdges(graph)

    var graphtype = subgraph ? 'subgraph' : 'digraph'

    output.push(`${graphtype} "${graph['name']}" {`);
    if (options.horizontal) {
      output.push(`rankdir=LR`);
    }
    output.push('labeljust=l;');
    output.push(`node [shape=${graph['shape'] ? graph['shape'] : 'box'}];`);
    if ('style' in graph) {
      output.push(`node [style="${graph.style}"]`)
    }
    if ('rank' in graph) {
      output.push(`rank=${graph.rank}`)
    }
    graph.nodes.forEach(n => {
      if (n.data.Type.indexOf('Custom::') !== -1) { // handle custom resources
        n.data.Type = 'AWS::CloudFormation::CustomResource'
      }
      let icon = iconMap[n.data.Type] || defaultIcon
      output.push(
        `"${n.name}" ` +
        `["label" = < <table border="0" cellborder="0">` +
        `<tr>` +
        `<td fixedsize="true" width="30" height="30">` +
        `<img src="${path.resolve(iconPath, icon)}"/>` +
        `</td>` +
        `<td>` +
        `${n.name}` +
        `</td>` +
        `</tr></table> >];`)
    })

    graph.subgraphs.forEach(function (s) {
      output.push(lib.writeGraph(s, true, options))
    });
    graph.edges.forEach(function (e) {
      var label = "";
      if (options.edgelabels && e.label !== undefined) {
        label = ` [label=${e.label}]`
      }
      output.push(`"${e['from']}" -> "${e['to']}" [dir=back]${label};`)
    });
    output.push('}');
    return output.join('\n')
  }
}

module.exports = lib
