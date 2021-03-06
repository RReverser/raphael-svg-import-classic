/*
* Raphael SVG Import Classic 0.2.0 - Extension to Raphael JS
* https://github.com/rreverser/raphael-svg-import-classic
*
* Raphael SVG Import Classic Copyright (c) 2013 Chris Chang, Ingvar Stepanyan
* Original Raphael SVG Import Copyright (c) 2009 Wout Fierens
* Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
*
*/

/* global Raphael */
Raphael.fn.importSVG = function (svgXML) {
  var myNewSet = this.set();
  var groupSet = {};
  var defaultTextAttr = {
    // stroke: "none"
    "text-anchor": "start"  // raphael defaults to "middle"
  };

  var forEach = Function.prototype.bind && Array.prototype.forEach ? Function.prototype.call.bind(Array.prototype.forEach) : function (arr, callback) {
    for (var i = 0, length = arr.length; i < length; i++) {
      callback(arr[i], i, arr);
    }
  };

  this.parseElement = function(elShape) {
    // skip text nodes
    if (elShape.nodeType === 3) {
      return;
    }
    var attr = {"stroke": "transparent", "stroke-width": 0, "fill":"#000"}, i;
    if (elShape.attributes){
      forEach(elShape.attributes, function (currentAttr) {
        attr[currentAttr.name] = currentAttr.value;
      });
    }
    var shape;
    var shapeName = elShape.nodeName;
    switch(shapeName) {
      case "svg":
      case "g":
        var groupId = elShape.getAttribute('id');
        var groupClass = elShape.getAttribute('class');
        if (groupId || groupClass) {
          var elShapeChildren = elShape.childNodes;
          for (var i = 0, length = elShapeChildren.length; i < length; i++) {
            var elShapeChild = elShapeChildren[i];
            if (elShapeChild.nodeType === 3) continue;
            if (groupId) {
              elShapeChild.setAttribute('data-svg-group', groupId);
            }
            if (groupClass) {
              elShapeChild.setAttribute('class', (elShapeChild.getAttribute('class') || '') + ' ' + groupClass);
            }
          }
        }
        var thisGroup = this.set();
        for (i = 0, length = elShape.childNodes.length; i < length; ++i) {
          thisGroup.push(this.parseElement(elShape.childNodes.item(i)));
        }

        // handle transform attribute
        if (attr.transform){
          var match = /translate\(([^,]+),([^,]+)\)/.exec(attr.transform);
          if (match.length == 3){
            thisGroup.translate(match[1], match[2]);
          }
        }

        // handle display=none
        if (attr.display === "none") {
          thisGroup.hide();
        }
        // hold onto thisGroup just in case
        if (groupId && elShape.childNodes.length) {
          groupSet[groupId] = thisGroup;
        }
        return;
      case "rect":
        if (attr.rx && attr.ry) {
          attr.r = (+(attr.rx || 0) + (+(attr.ry || 0))) / 2;
          delete attr.rx;
          delete attr.ry;
        } else {
          attr.r = attr.rx || attr.ry || 0;
          delete attr.rx;
          delete attr.ry;
        }
        /* falls through */
      case "circle":
      case "ellipse":
        shape = this[shapeName]();
      break;
      case "path":
        shape = this.path(attr.d);
        delete attr.d;
      break;
      case "polygon":
        shape = this.polygon(attr);
      break;
      case "polyline":
        shape = this.polyline(attr);
      break;
      case "line":
        shape = this.line(attr);
      break;
      case "image":
        shape = this.image();
      break;
      case "text":
        for (var key in defaultTextAttr){
          if (!attr[key] && defaultTextAttr.hasOwnProperty(key)) {
            attr[key] = defaultTextAttr[key];
          }
        }
        shape = this.text(attr.x, attr.y, elShape.text || elShape.textContent);
      break;
      default:
        var elSVG = elShape.getElementsByTagName("svg");
        if (elSVG.length){
          elSVG[0].normalize();
          this.parseElement(elSVG[0]);
        }
        return;
    }

    // apply matrix transformation
    var matrix = attr.transform;
    if (matrix) {
      matrix = matrix.substring(7, matrix.length-1).split(' ')
               .map(function(x){ return parseFloat(x); });
      var m = shape.matrix;
      m.add.apply(m, matrix);
      // this seems like a very odd step:
      shape.transform(m.toTransformString());
      delete attr.transform;
    }

    shape.attr(attr);

    // copy group id
    var shapeClass = elShape.getAttribute('class');
    if (shapeClass) {
      shape.node.setAttribute('class', (shape.node.getAttribute('class') || '') + ' ' + shapeClass);
    }
    shape.node.setAttribute('data-svg', shapeName);

    var group = elShape.getAttribute('data-svg-group');
    if (group) {
      shape.node.setAttribute('data-svg-group', group);
    }

    var nodeID = elShape.getAttribute("id");
    if (nodeID) {
      shape.node.id = nodeID;
    }
    
    myNewSet.push(shape);
    return shape;
  };

  this.parseElement(svgXML);
  
  var paper = this;
  forEach(svgXML.getElementsByTagName('style'), function (xmlStyle, i) {
    var domStyle = document.createElement('style'), css = xmlStyle.textContent || xmlStyle.text;
    domStyle.type = 'text/css';
    document.head.appendChild(domStyle);
    var rules;
    if (domStyle.styleSheet) {
      domStyle.styleSheet.cssText = css;
      rules = domStyle.styleSheet.rules;
    } else {
      domStyle.appendChild(document.createTextNode(css));
      rules = domStyle.sheet.cssRules;
    }
    forEach(rules, function (rule) {
      var style = rule.style, elements = document.querySelectorAll(rule.selectorText), attrs = {};
      for (var name in Raphael._availableAttrs) {
        var value = style[name];
        if (!value) continue;
        // fix for Chrome
        attrs[name] = typeof Raphael._availableAttrs[name] === 'number' ? parseFloat(value) : value;
      }
      forEach(elements, function (element) {
        paper.getById(element.raphaelid).attr(attrs);
      });
    });
  });

  var groupsExist = false, x;
  for (x in groupSet){
    groupsExist = true;
    break;
  }
  if (groupsExist) {
    myNewSet.groups = groupSet;
  }
  return myNewSet;
};


Raphael.fn.line = function(attr){
  var pathString = ["M",
                    attr.x1,
                    attr.y1,
                    "L",
                    attr.x2,
                    attr.y2,
                    "Z"];
  delete attr.x1;
  delete attr.y1;
  delete attr.x2;
  delete attr.y2;
  return this.path(pathString);
};


// extending raphael with a polygon function
Raphael.fn.polygon = function(attr) {
  var pointString = attr.points;
  var poly = ['M'],
      point = pointString.split(' ');

  for(var i=0; i < point.length; i++) {
     var c = point[i].split(',');
     for(var j=0; j < c.length; j++) {
        var d = parseFloat(c[j]);
        if (!isNaN(d))
          poly.push(d);
     }
     if (i === 0)
      poly.push('L');
  }
  poly.push('Z');
  delete attr.points;
  return this.path(poly);
};


Raphael.fn.polyline = function(attr) {
  var pointString = attr.points;
  var poly = ['M'],
      point = pointString.split(' ');

  for(var i=0; i < point.length; i++) {
     var c = point[i].split(',');
     for(var j=0; j < c.length; j++) {
        var d = parseFloat(c[j]);
        if (!isNaN(d))
          poly.push(d);
     }
     if (i === 0)
      poly.push('L');
  }
  delete attr.points;
  return this.path(poly);
};
