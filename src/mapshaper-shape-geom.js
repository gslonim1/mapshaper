/* @requires mapshaper-shapes, mapshaper-geom */

// Calculations for planar geometry of shapes
// TODO: consider 3D versions of some of these

geom.getShapeArea = function(shp, arcs) {
  return Utils.reduce(shp, function(area, ids) {
    var iter = arcs.getShapeIter(ids);
    return area + geom.getPathArea(iter);
  }, 0);
};

geom.getSphericalShapeArea = function(shp, arcs) {
  if (!MapShaper.probablyDecimalDegreeBounds(arcs.getBounds())) {
    error("[getSphericalShapeArea()] Function requires decimal degree coordinates");
  }
  return Utils.reduce(shp, function(area, ids) {
    var iter = arcs.getShapeIter(ids);
    return area + geom.getSphericalPathArea(iter);
  }, 0);
};

// alternative using equal-area projection
geom.getSphericalShapeArea2 = function(shp, arcs) {
  return Utils.reduce(shp, function(total, ids) {
    var iter = arcs.getShapeIter(ids);
    iter = geom.wrapPathIter(iter, geom.projectGall);
    return total + geom.getPathArea(iter);
  }, 0);
};

// Return path with the largest (area) bounding box
// @shp array of array of arc ids
// @arcs ArcCollection
geom.getMaxPath = function(shp, arcs) {
  var maxArea = 0;
  return Utils.reduce(shp, function(maxPath, path) {
    var bbArea = arcs.getSimpleShapeBounds(path).area();
    if (bbArea > maxArea) {
      maxArea = bbArea;
      maxPath = path;
    }
    return maxPath;
  }, null);
};

// @ids array of arc ids
// @arcs ArcCollection
geom.getAvgPathXY = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  if (!iter.hasNext()) return null;
  var x0 = iter.x,
      y0 = iter.y,
      count = 0,
      sumX = 0,
      sumY = 0;
  while (iter.hasNext()) {
    count++;
    sumX += iter.x;
    sumY += iter.y;
  }
  if (count === 0 || iter.x !== x0 || iter.y !== y0) {
    sumX += x0;
    sumY += y0;
    count++;
  }
  return {
    x: sumX / count,
    y: sumY / count
  };
};

geom.getPathCentroid = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      sum = 0,
      sumX = 0,
      sumY = 0,
      ax, ay, tmp, area;
  if (!iter.hasNext()) return null;
  ax = iter.x;
  ay = iter.y;
  while (iter.hasNext()) {
    tmp = ax * iter.y - ay * iter.x;
    sum += tmp;
    sumX += tmp * (iter.x + ax);
    sumY += tmp * (iter.y + ay);
    ax = iter.x;
    ay = iter.y;
  }
  area = sum / 2;
  if (area === 0) {
    return geom.getAvgPathXY(ids, arcs);
  } else return {
    x: sumX / (6 * area),
    y: sumY / (6 * area)
  };
};

geom.getShapeCentroid = function(shp, arcs) {
  var maxPath = geom.getMaxPath(shp, arcs);
  return maxPath ? geom.getPathCentroid(maxPath, arcs) : null;
};

// TODO: decide how to handle points on the boundary
geom.testPointInShape = function(x, y, shp, arcs) {
  var intersections = 0;
  Utils.forEach(shp, function(ids) {
    if (geom.testPointInRing(x, y, ids, arcs)) {
      intersections++;
    }
  });
  return intersections % 2 == 1;
};

// Get a point suitable for anchoring a label
// Method:
// - find centroid
// - ...
//
geom.getInteriorPoint = function(shp, arcs) {


};

geom.getPointToPathDistance = function(px, py, ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  if (!iter.hasNext()) return Infinity;
  var ax = iter.x,
      ay = iter.y,
      paSq = distanceSq(px, py, ax, ay),
      pPathSq = paSq,
      pbSq, abSq,
      bx, by;

  while (iter.hasNext()) {
    bx = iter.x;
    by = iter.y;
    pbSq = distanceSq(px, py, bx, by);
    abSq = distanceSq(ax, ay, bx, by);
    pPathSq = Math.min(pPathSq, pointSegDistSq(paSq, pbSq, abSq));
    ax = bx;
    ay = by;
    paSq = pbSq;
  }
  return Math.sqrt(pPathSq);
};

geom.getYIntercept = function(x, ax, ay, bx, by) {
  return ay + (x - ax) * (by - ay) / (bx - ax);
};

geom.getXIntercept = function(y, ax, ay, bx, by) {
  return ax + (y - ay) * (bx - ax) / (by - ay);
};

// Return signed distance of a point to a shape
//
geom.getPointToShapeDistance = function(x, y, shp, arcs) {
  var minDist = Utils.reduce(shp, function(minDist, ids) {
    var pathDist = geom.getPointToPathDistance(x, y, ids, arcs);
    return Math.min(minDist, pathDist);
  }, Infinity);
  return minDist;
};

geom.testPointInRing = function(x, y, ids, arcs) {
  /*
  // arcs.getSimpleShapeBounds() doesn't apply simplification, can't use here
  if (!arcs.getSimpleShapeBounds(ids).containsPoint(x, y)) {
    return false;
  }
  */
  var count = 0;
  MapShaper.forEachPathSegment(ids, arcs, function(a, b, xx, yy) {
    count += geom.testRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
  });
  return count % 2 == 1;
};

/*
geom.testPointInRing = function(x, y, ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  if (!iter.hasNext()) return false;
  var x0 = iter.x,
      y0 = iter.y,
      ax = x0,
      ay = y0,
      bx, by,
      intersections = 0;

  while (iter.hasNext()) {
    bx = iter.x;
    by = iter.y;
    intersections += geom.testRayIntersection(x, y, ax, ay, bx, by);
    ax = bx;
    ay = by;
  }

  return intersections % 2 == 1;
};
*/

// test if a vertical ray starting at poing (x, y) intersects a segment
// returns 1 if intersection, 0 if no intersection, NaN if point touches segment
geom.testRayIntersection = function(x, y, ax, ay, bx, by) {
  var hit = 0, yInt;
  if (x < ax && x < bx || x > ax && x > bx || y >= ay && y >= by) {
      // no intersection
  } else if (x === ax) {
    if (y === ay) {
      hit = NaN;
    } else if (bx < x && y < ay) {
      hit = 1;
    }
  } else if (x === bx) {
    if (y === by) {
      hit = NaN;
    } else if (ax < x && y < by) {
      hit = 1;
    }
  } else if (y < ay && y < by) {
    hit = 1;
  } else {
    yInt = geom.getYIntercept(x, ax, ay, bx, by);
    if (yInt > y) {
      hit = 1;
    } else if (yInt == y) {
      hit = NaN;
    }
  }
  return hit;
};

geom.getSphericalPathArea = function(iter) {
  var sum = 0,
      started = false,
      deg2rad = Math.PI / 180,
      x, y, xp, yp;
  while (iter.hasNext()) {
    x = iter.x * deg2rad;
    y = Math.sin(iter.y * deg2rad);
    if (started) {
      sum += (x - xp) * (2 + y + yp);
    } else {
      started = true;
    }
    xp = x;
    yp = y;
  }
  return sum / 2 * 6378137 * 6378137;
};

// Get path area from a point iterator
geom.getPathArea = function(iter) {
  var sum = 0,
      x, y;
  if (iter.hasNext()) {
    x = iter.x;
    y = iter.y;
    while (iter.hasNext()) {
      sum += iter.x * y - x * iter.y;
      x = iter.x;
      y = iter.y;
    }
  }
  return sum / 2;
};

geom.wrapPathIter = function(iter, project) {
  return {
    hasNext: function() {
      if (iter.hasNext()) {
        project(iter.x, iter.y, this);
        return true;
      }
      return false;
    }
  };
};

geom.projectGall = (function() {
  var R = 6378137;
  var deg2rad = Math.PI / 180;
  var kx = R * deg2rad / Math.sqrt(2);
  var ky = R * Math.sqrt(2);
  return function(x, y, p) {
    p = p || {};
    p.x = x * kx;
    p.y = ky * Math.sin(deg2rad * y);
    return p;
  };
}());

// Get path area from an array of [x, y] points
// TODO: consider removing duplication with getPathArea(), e.g. by
//   wrapping points in an iterator.
//
geom.getPathArea2 = function(points) {
  var sum = 0,
      x, y, p;
  for (var i=0, n=points.length; i<n; i++) {
    p = points[i];
    if (i > 0) {
      sum += p[0] * y - x * p[1];
    }
    x = p[0];
    y = p[1];
  }
  return sum / 2;
};

// TODO: consider removing duplication with above
geom.getPathArea3 = function(xx, yy, start, len) {
  var sum = 0,
      i = start | 0,
      end = i + (len ? len | 0 : xx.length - i) - 1;
  if (i < 0 || end >= xx.length) {
    error("Out-of-bounds array index");
  }
  for (; i < end; i++) {
    sum += xx[i+1] * yy[i] - xx[i] * yy[i+1];
  }
  return sum / 2;
};

geom.getPathArea4 = function() {

};

geom.getPathBounds = function(points) {
  var bounds = new Bounds();
  for (var i=0, n=points.length; i<n; i++) {
    bounds.mergePoint(points[i][0], points[i][1]);
  }
  return bounds;
};

/*
geom.transposeXYCoords = function(xx, yy) {
  var points = [];
  for (var i=0, len=xx.length; i<len; i++) {
    points.push([xx[i], yy[i]]);
  }
  return points;
};
*/

geom.transposePoints = function(points) {
  var xx = [], yy = [], n=points.length;
  for (var i=0; i<n; i++) {
    xx.push(points[i][0]);
    yy.push(points[i][1]);
  }
  return [xx, yy];
};