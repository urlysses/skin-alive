/*jslint browser: true*/
(function (twgl) {
    "use strict";
    var flesh = document.getElementById("flesh");
    var fleshnormal = document.createElement("canvas");
    var flesh3d = document.getElementById("flesh3d");
    var user = document.createElement("canvas");
    flesh.width = fleshnormal.width = flesh3d.width = user.width = window.innerWidth;
    flesh.height = fleshnormal.height = flesh3d.height = user.height = window.innerHeight;

    var fleshcontext = flesh.getContext("2d");
    var normalcontext = fleshnormal.getContext("2d");
    var usercontext = user.getContext("2d");

    var TO_RAD = Math.PI / 180;
    var w = flesh.width,
        h = flesh.height,
        i = 0;


    // 3D
    twgl.setDefaults({attribPrefix: "a_"});
    var gl = twgl.getWebGLContext(flesh3d);
    var programInfo = twgl.createProgramInfo(gl, ["vshader", "fshader"]);
    var plane = twgl.primitives.createPlaneBufferInfo(gl, w, h);

    var tangentLoc = gl.getAttribLocation(programInfo.program, "a_tangent");
    gl.enableVertexAttribArray(tangentLoc);

    var tangentBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tangentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new window.Float32Array([
        2.0, 0.0, 0.0,
        2.0, 0.0, 0.0,
        2.0, 0.0, 0.0,
        2.0, 0.0, 0.0
    ]), gl.STATIC_DRAW);
    tangentBuffer.count = 4;

    var m4 = twgl.m4;
    var v3 = twgl.v3;
    var bigger = w > h ? w : h;
    var smaller = w > h ? h : w;
    var lightWorldPosition = [0, h / 2, -bigger];
    var lightColor = [1, 1, 1, 1];
    var camera = m4.identity();
    var texture = twgl.createTexture(gl, {src: fleshcontext.canvas});
    var bumpmap = twgl.createTexture(gl, {src: fleshnormal});
    var view = m4.identity();
    var viewProjection = m4.identity();
    var uniforms = {
        u_lightWorldPos: lightWorldPosition,
        u_lightColor: lightColor,
        u_diffuseMult: [1, 1, 1, 1],
        u_specular: [0.25, 0.25, 0.25, 0.25],
        u_shininess: 5,
        u_specularFactor: 0.4,
        u_diffuse: texture,
        u_viewInverse: camera,
        u_world: m4.identity(),
        u_worldInverseTranspose: m4.identity(),
        u_worldViewProjection: m4.identity(),
        u_bumpmap: bumpmap
    };
    var skin = {
        translation: [0, 0, h / 2],
        uniforms: uniforms
    };

    // Bog-standard noise
    var imgdata = fleshcontext.createImageData(w, h),
        buffer32 = new window.Uint32Array(imgdata.data.buffer),
        len = buffer32.length;
    var noise = document.createElement("canvas");
    var noisecontext = noise.getContext("2d");
    noise.width = w;
    noise.height = h;
    for(i = 0; i < len; i += 2) {
        if (Math.random() < 0.5) {
            buffer32[i] = 0xff000000;
            buffer32[i + 1] = 0xff000000;
        }
    }
    noisecontext.putImageData(imgdata, 0, 0);

    // Veins
    // kudos to https://lisimba.org/lichtenberg/lichtenberg-live.html
    function Venule () {
        this.x = 0;
        this.y = 0;
        this.xPos = 0;
        this.yPos = 0;
        this.childVenule = null;
        this.parentVenules = [];
        this.probableLinks = [];
        this.probableLinksRemaining = [];
        this.visibility = 1;
        this.seen = false;
    }
    function VeinSet () {
        var veincanvas = document.createElement("canvas");
        veincanvas.width = w;
        veincanvas.height = h;
        var veincanvascontext = veincanvas.getContext("2d");
        this.context = veincanvascontext;
        this.venules = [];

        // add to venules array
        var count = 100;
        var xCount = count;
        var yCount = count;
        var spacing = w / (xCount - 1);
        this.addVenules(0, 0, xCount, yCount, spacing);

        // link venules
        this.preLinkVenules();
        var x = Math.round(count / 2);
        var y = 3;
        this.linkVenules(x, y);
        var maxSubVisibility = this.processVisibility(this.venules[x][y]);
        this.venlines = this.gatherVenuleLines(maxSubVisibility);
        this.context.clearRect(0, 0, w, h);

        this.drawVenuleLines(24, 75, 102, 0.2, 4);
        this.drawVenuleLines(24, 75, 102, 1, 1.3);
    }
    VeinSet.prototype.addVenules = function (xPosOffset, yPosOffset, xCount, yCount, spacing) {
        var halfspacing = spacing / 2;

        var x, y, ven;
        for (x = 0; x < xCount; x++) {
            this.venules[x] = [];
            for (y = 0; y < yCount; y++) {
                ven = new Venule();
                ven.x = x;
                ven.y = y;
                ven.xPos = xPosOffset + x * spacing + (Math.random() * spacing) - halfspacing;
                ven.yPos = yPosOffset + y * spacing + (Math.random() * spacing) - halfspacing;
                this.venules[x][y] = ven;
            }
        }
    };
    VeinSet.prototype.preLinkVenules = function () {
        var lastX, lastY;
        lastX = this.venules.length - 1;
        lastY = this.venules[0].length - 1;
        var venules = this.venules;
        this.venules.forEach(function (v, ix) {
            v.forEach(function (ven, iy) {
                if (ix > 0) {
                    if (iy > 0) {
                        ven.probableLinks.push(venules[ix - 1][iy - 1]);
                    }
                    ven.probableLinks.push(venules[ix - 1][iy]);
                    if (iy < lastY) {
                        ven.probableLinks.push(venules[ix - 1][iy + 1]);
                    }
                }
                if (iy > 0) {
                    ven.probableLinks.push(venules[ix][iy - 1]);
                }
                if (iy < lastY) {
                    ven.probableLinks.push(venules[ix][iy + 1]);
                }
                if (ix < lastX) {
                    if (iy > 0) {
                        ven.probableLinks.push(venules[ix + 1][iy - 1]);
                    }
                    ven.probableLinks.push(venules[ix + 1][iy]);
                    if (iy < lastY) {
                        ven.probableLinks.push(venules[ix + 1][iy + 1]);
                    }
                }
            });
        });
    };
    VeinSet.prototype.linkVenules = function (x, y) {
        this.venules.forEach(function (v) {
            v.forEach(function (ven) {
                ven.parentVenules = [];
                ven.childVenule = null;

                ven.probableLinksRemaining = ven.probableLinks.slice(0);
            });
        });

        this.venules[x][y].seen = true;

        var activeVenules = [];
        activeVenules.push(this.venules[x][y]);
        var ven, madeLink, probableLink;
        while (activeVenules.length > 0) {
            ven = activeVenules.splice(Math.floor(Math.random() * activeVenules.length), 1)[0];

            madeLink = false;
            while (ven.probableLinksRemaining.length > 0) {
                probableLink = ven.probableLinksRemaining.splice(Math.floor(Math.random() * ven.probableLinksRemaining.length), 1)[0];
                if (!probableLink.seen) {
                    probableLink.seen = true;
                    probableLink.childVenule = ven;
                    ven.parentVenules.push(probableLink);
                    activeVenules.push(probableLink);
                    madeLink = true;
                    break;
                }
            }

            if (madeLink) {
                activeVenules.push(ven);
            }
        }

    };
    VeinSet.prototype.processVisibilityAux = function (ven) {
        var _this = this;
        ven.parentVenules.forEach(function (v) {
            ven.visibility += _this.processVisibilityAux(v);
        });
        return ven.visibility;
    };
    VeinSet.prototype.processVisibility = function (ven) {
        var subvis, maxsubvis = 0;
        var _this = this;
        ven.parentVenules.forEach(function (v) {
            subvis = _this.processVisibilityAux(v);
            maxsubvis = Math.max(subvis, maxsubvis);
            ven.visibility += subvis;
        });
        return maxsubvis;
    };
    VeinSet.prototype.gatherVenuleLines = function (maxSubVisibility) {
        var vnls = [];

        var cutoff = 0.00005;   // Lower shows more smaller bits.
        var emphasize = 1 / 5.8;   // Lower pulls everything towards bright.

        this.venules.forEach(function (ven) {
            ven.forEach(function (v) {
                if (v.childVenule) {
                    vnls.push([
                        v.xPos,
                        v.yPos,
                        v.childVenule.xPos,
                        v.childVenule.yPos,
                        Math.min(1, Math.pow(Math.max(0, (v.visibility / maxSubVisibility) - cutoff), emphasize))]);
                }
            });
        });
        vnls.sort( function(a, b) { return a[4] - b[4]; } );
        return vnls;
    };
    VeinSet.prototype.drawVenuleLines = function (r, g, b, a, w) {
        this.context.lineCap = "round";
        this.context.lineJoin = "round";
        var _this = this;
        this.venlines.forEach(function (line) {
            _this.context.lineWidth = (2 * w * line[4]);
            _this.context.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + (a * line[4]) + ")";
            _this.context.beginPath();
            _this.context.moveTo(line[0], line[1]);
            _this.context.lineTo(line[2], line[3]);
            _this.context.stroke();
        });
    };
    var veins = new VeinSet();


    // Perlin/Simplex noise
    // kudos to http://asserttrue.blogspot.ca/2012/01/procedural-textures-in-html5-canvas.html
    // and https://github.com/jwagner/simplex-noise.js
    function SimplexNoise(random) {
        if (!random) {
            random = Math.random;
        }
        var perlincanvas = document.createElement("canvas");
        perlincanvas.width = w;
        perlincanvas.height = h;
        this.context = perlincanvas.getContext("2d");

        this.p = new window.Uint8Array(256);
        this.perm = new window.Uint8Array(512);
        this.permMod12 = new window.Uint8Array(512);
        for (i = 0; i < 256; i++) {
            this.p[i] = random() * 256;
        }
        for (i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }

        this.F3 = 1.0 / 3.0;
        this.G3 = 1.0 / 6.0;
    }
    SimplexNoise.prototype = {
        grad3: new window.Float32Array([1, 1, 0,
                                        -1, 1, 0,
                                        1, -1, 0,
                                        -1, -1, 0,
                                        1, 0, 1,
                                        -1, 0, 1,
                                        1, 0, -1,
                                        -1, 0, -1,
                                        0, 1, 1,
                                        0, -1, 1,
                                        0, 1, -1,
                                        0, -1, -1]),
        noise: function (xin, yin, zin) {
            var permMod12 = this.permMod12,
                perm = this.perm,
                grad3 = this.grad3;
            var n0, n1, n2, n3;
            var s = (xin + yin + zin) * this.F3;
            var ii = Math.floor(xin + s);
            var j = Math.floor(yin + s);
            var k = Math.floor(zin + s);
            var t = (ii + j + k) * this.G3;
            var X0 = ii - t;
            var Y0 = j - t;
            var Z0 = k - t;
            var x0 = xin - X0;
            var y0 = yin - Y0;
            var z0 = zin - Z0;
            var i1, j1, k1;
            var i2, j2, k2;
            if (x0 >= y0) {
                if (y0 >= z0) {
                    i1 = i2 = j2 = 1;
                    j1 = k1 = k2 = 0;
                } else if (x0 >= z0) {
                    i1 = i2 = k2 = 1;
                    j1 = k1 = j2 = 0;
                } else {
                    i1 = j1 = j2 = 0;
                    k1 = i2 = k2 = 1;
                }
            } else {
                if (y0 < z0) {
                    i1 = j1 = i2 = 0;
                    k1 = j2 = k2 = 1;
                } else if (x0 < z0) {
                    i1 = k1 = i2 = 0;
                    j1 = j2 = k2 = 1;
                } else {
                    i1 = k1 = k2 = 0;
                    j1 = i2 = j2 = 1;
                }
            }
            var x1 = x0 - i1 + this.G3;
            var y1 = y0 - j1 + this.G3;
            var z1 = z0 - k1 + this.G3;
            var x2 = x0 - i2 + 2.0 * this.G3;
            var y2 = y0 - j2 + 2.0 * this.G3;
            var z2 = z0 - k2 + 2.0 * this.G3;
            var x3 = x0 - 1.0 + 3.0 * this.G3;
            var y3 = y0 - 1.0 + 3.0 * this.G3;
            var z3 = z0 - 1.0 + 3.0 * this.G3;
            var ii2 = ii & 255;
            var jj = j & 255;
            var kk = k & 255;
            var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
            if (t0 < 0) {
                n0 = 0.0;
            } else {
                var gi0 = permMod12[ii2 + perm[jj + perm[kk]]] * 3;
                t0 *= t0;
                n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0 + grad3[gi0 + 2] * z0);
            }
            var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
            if (t1 < 0) {
                n1 = 0.0;
            } else {
                var gi1 = permMod12[ii2 + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
                t1 *= t1;
                n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1 + grad3[gi1 + 2] * z1);
            }
            var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
            if (t2 < 0) {
                n2 = 0.0;
            } else {
                var gi2 = permMod12[ii2 + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
                t2 *= t2;
                n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2 + grad3[gi2 + 2] * z2);
            }
            var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
            if (t3 < 0) {
                n3 = 0.0;
            } else {
                var gi3 = permMod12[ii2 + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
                t3 *= t3;
                n3 = t3 * t3 * (grad3[gi3] * x3 + grad3[gi3 + 1] * y3 + grad3[gi3 + 2] * z3);
            }
            return 32.0 * (n0 + n1 + n2 + n3);
        }
    };
    SimplexNoise.prototype.drawViaCallback = function (callback) {
        var canvasData = this.context.getImageData(0, 0, w, h);
        var x, y, pixel;

        var buf = new window.ArrayBuffer(canvasData.data.length),
            buf8 = new window.Uint8ClampedArray(buf),
            data = new window.Uint32Array(buf);

        data[1] = 0x0a0b0c0d;
        var isLittleEndian = true;
        if (buf[4] === 0x0a && buf[5] === 0x0b && buf[6] === 0x0c && buf[7] === 0x0d) {
            isLittleEndian = false;
        }
        for (y = 0; y < h; y++) {
            for (x = 0; x < w; x++) {
                pixel = callback({r: 255, g: 255, b: 255, x: x, y: y});
                if (isLittleEndian) {
                    data[y * w + x] = (255 << 24) | (pixel.r << 16) | (pixel.g << 8) | pixel.b;
                } else {
                    data[y * w + x] = (pixel.r << 24) | (pixel.g << 16) | (pixel.b << 8) | 255;
                }
            }
        }
        canvasData.data.set(buf8);
        this.context.putImageData(canvasData, 0, 0);
    };
    SimplexNoise.prototype.render = function (noisefn) {
        this.context.fillStyle = "#fff";
        this.context.fillRect(0, 0, w, h);
        this.drawViaCallback(noisefn);
    };
    var SNoise = new SimplexNoise();


    // Voronoi
    function CellularGrouping () {
        var cellcanvas = document.createElement("canvas");
        this.w = cellcanvas.width = Math.round(w / 3);
        this.h = cellcanvas.height = Math.round(h / 3);
        this.context = cellcanvas.getContext("2d");

        var verts = [];
        var p;
        function isTooClose (pt) {
            var ii;
            var vlen = verts.length;
            var pr, xdiff, ydiff;
            for (ii = 0; ii < vlen; ii++) {
                pr = verts[ii];
                xdiff = pt.x - pr.x;
                ydiff = pr.y - pt.y;
                if (Math.sqrt((xdiff * xdiff) + (ydiff * ydiff)) <= 16) {
                    return true;
                }
            }

            return false;
        }
        for (i = 0; i < 200; i++) {
            p = {
                x: Math.round(Math.random() * this.w),
                y: Math.round(Math.random() * this.h)
            };

            if (isTooClose(p) === false) {
                verts.push(p);
            }
        }
        verts.sort(function (a, b) {
            if(a.y < b.y) {
                return -1;
            }
            if(a.y > b.y) {
                return 1;
            }
            if(a.x < b.x) {
                return -1;
            }
            if(a.x > b.x) {
                return 1;
            }
            return 0;
        });
        this.verts = verts;
    }
    CellularGrouping.prototype.createCells = function () {
        // kudos to http://somethinghitme.com/projects/cell/ ... SQRT(D2 - D1)
        var verts = this.verts,
            imageData = this.context.createImageData(this.w, this.h),
            pSize = 1,
            thing = 255 / 6,
            pLen = verts.length,
            points = [],
            WH = this.w * this.h;

        // Check distance with all other points
        var x, y, pix, piy, p, c, dist, dist2, firstPoint, curMinDist, curMinDist2;
        for (x = 0; x < this.w; x += pSize) {
            for (y = 0; y < this.h; y += pSize) {
                curMinDist = curMinDist2 = WH;

                for (p = 0; p < pLen; p++) {
                    dist = Math.sqrt((verts[p].x - x) *(verts[p].x - x) + (verts[p].y - y) * (verts[p].y - y));

                    if(dist < curMinDist) {
                        firstPoint = p;
                        curMinDist = dist;
                    }
                }


                for ( p = 0; p < pLen; p++) {
                    if(p !== firstPoint){
                        dist2 = Math.sqrt((verts[p].x - x) *(verts[p].x - x) + (verts[p].y - y) * (verts[p].y - y));

                        if(dist2 < curMinDist2){
                            curMinDist2 = dist2;
                        }
                    }
                }
                points[y * this.w + x] = curMinDist2 - curMinDist;
            }
        }

        // Draw points
        for(x = 0; x < this.w; x += pSize){
            for(y = 0; y < this.h; y += pSize){
                for(pix = 0; pix < pSize; pix++){
                    for(piy = 0; piy < pSize; piy++){
                        i = ((x + pix) + (y + piy) * this.w) * 4;
                        c = parseInt(points[y * this.w + x] * thing, 10);
                        imageData.data[i] = c;
                        imageData.data[i+1] = c;
                        imageData.data[i+2] = c;
                        imageData.data[i+3] = 255 * (1 - c / 255);

                    }
                }
            }
        }

        this.context.putImageData(imageData, 0, 0);
    };
    CellularGrouping.prototype.preparePattern = function (fleshbase) {
        var cw, ch;
        var ca = document.createElement("canvas");
        var context = ca.getContext("2d");
        var norm = document.createElement("canvas");
        var normcontext = norm.getContext("2d");

        cw = ca.width = norm.width = Math.round(this.context.canvas.width / 2);
        ch = ca.height = norm.height = Math.round(this.context.canvas.height / 2);

        // Fill pattern with skin tone
        context.fillStyle = fleshbase;
        context.fillRect(0, 0, w, h);

        normcontext.fillStyle = "rgba(127, 127, 255, 1)";
        normcontext.fillRect(0, 0, w, h);

        // draw once for lighting
        context.globalCompositeOperation = "overlay";
        context.globalAlpha = 0.35;
        context.shadowColor = "rgba(255, 255, 255, 0.5)";
        context.shadowBlur = 1.0;
        context.shadowOffsetX = 0.0;
        context.shadowOffsetY = 2.0;
        context.drawImage(this.context.canvas, 0, 0, cw, ch);

        normcontext.globalAlpha = 0.6;
        normcontext.globalCompositeOperation = "overlay";
        normcontext.shadowColor = "rgba(255, 127, 255, 1)";
        normcontext.shadowBlur = 1.0;
        normcontext.shadowOffsetX = -2.0;
        normcontext.shadowOffsetY = 0.0;
        normcontext.drawImage(this.context.canvas, 0, 0, cw, ch);

        // draw again for lines
        context.globalCompositeOperation = "multiply";
        context.globalAlpha = 0.03;
        context.shadowColor = "rgba(0, 0, 0, 0.7)";
        context.shadowBlur = 0.001;
        context.shadowOffsetX = 0.0;
        context.shadowOffsetY = -3.0;
        context.drawImage(this.context.canvas, 0, 0, cw, ch);

        normcontext.globalCompositeOperation = "overlay";
        normcontext.shadowColor = "rgba(127, 255, 127, 1)";
        normcontext.shadowBlur = 1.0;
        normcontext.shadowOffsetX = 0.0;
        normcontext.shadowOffsetY = -3.0;
        normcontext.drawImage(this.context.canvas, 0, 0, cw, ch);

        // reset context
        normcontext.globalAlpha = context.globalAlpha = 1.0;
        normcontext.shadowColor = context.shadowColor = null;
        normcontext.shadowBlur = context.shadowBlur = null;
        normcontext.shadowOffsetX = context.shadowOffsetX = null;
        normcontext.shadowOffsetY = context.shadowOffsetY = null;
        normcontext.globalCompositeOperation = context.globalCompositeOperation = "source-over";

        this.normal = normcontext;

        this.pattern = context;
    };
    var Voronoi = new CellularGrouping();
    Voronoi.createCells();

    function SpotSet () {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        this.context = canvas.getContext("2d");

        this.spots = [];
        this.spotslen = Math.round(Math.random() * 100);
        var s;
        for (i = 0; i < this.spotslen; i++) {
            s = {
                x: Math.random() * w,
                y: Math.random() * h,
                radius: Math.random() * 4,
                opacity: Math.min(Math.random() + 0.3, 1),
                stretch: Math.random() + 1,
                orientation: (Math.random() * 360) * Math.PI / 180,
                blear: Math.random() * 3 + 1
            };
            this.spots.push(s);
            this.renderSpot(s);
        }
    }
    SpotSet.prototype.renderSpot = function (spot) {
        this.context.save();

        this.context.translate(spot.x, spot.y);
        this.context.rotate(spot.orientation);
        this.context.scale(1, spot.stretch);

        this.context.beginPath();
        this.context.arc(0, 0, spot.radius, 0, 2 * Math.PI, false);
        this.context.closePath();

        this.context.fillStyle = this.context.shadowColor = "rgba(0, 0, 0, " + spot.opacity + ")";
        this.context.shadowBlur = spot.blear;
        this.context.fill();

        this.context.restore();
    };
    var spots = new SpotSet();

    var fleshad = (function () {
        var white = "rgb(195, 210, 210)";
        var red = "rgb(185, 20, 20)";

        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        canvas.width = 732;
        canvas.height = 94;
        canvas.bg = "rgb(0, 20, 20)";

        var face = (function () {
            var facecanvas = document.createElement("canvas");
            facecanvas.width = 86;
            facecanvas.height = 124;
            facecanvas.color = canvas.bg;
            var facecontext = facecanvas.getContext("2d");
            facecontext.fillStyle = facecanvas.color;
            facecontext.save();
            facecontext.translate(-145,-88);
            facecontext.beginPath();
            facecontext.moveTo(187.25,88.067);
            facecontext.bezierCurveTo(187.25,88.067,192.785,120.585,168.398,122.267);
            facecontext.bezierCurveTo(168.398,122.267,155.317,126.64399999999999,170.427,137.367);
            facecontext.bezierCurveTo(175.679,141.093,164.878,153.39,157.897,152.56699999999998);
            facecontext.bezierCurveTo(150.916,151.74399999999997,181.629,175.78099999999998,207.785,156.06099999999998);
            facecontext.bezierCurveTo(219.575,147.17199999999997,190.04399999999998,204.95299999999997,153.821,178.42);
            facecontext.bezierCurveTo(145.896,172.61399999999998,145.673,186.935,147.715,189.177);
            facecontext.bezierCurveTo(154.246,196.345,146.484,195.671,145.196,201.97);
            facecontext.bezierCurveTo(143.908,208.269,151.028,210.857,151.028,210.857);
            facecontext.bezierCurveTo(151.028,210.857,165.34199999999998,212.547,178.945,210.37199999999999);
            facecontext.bezierCurveTo(192.01999999999998,208.28199999999998,203.988,199.75799999999998,203.971,199.63199999999998);
            facecontext.lineTo(221.108,175.33199999999997);
            facecontext.lineTo(230.75300000000001,140.64899999999997);
            facecontext.lineTo(225.674,121.59099999999998);
            facecontext.lineTo(202.129,94.281);
            facecontext.closePath();
            facecontext.fill();
            facecontext.restore();
            return facecanvas;
        }());

        context.beginPath();
        context.shadowBlur = 2;
        context.shadowBlur = 2.4;
        context.shadowColor = context.fillStyle = canvas.bg;
        context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.strokeStyle = red;
        context.lineWidth = 8;
        context.beginPath();
        context.rect(0, 0, canvas.width, canvas.height);
        context.closePath();
        context.stroke();

        // Slogan
        context.beginPath();
        context.shadowColor = context.fillStyle = white;
        context.font = "italic 30px Helvetica, sans-serif";
        context.fillText("I appreciate the                  taste!™", 98, 55);
        context.font = "bold italic 30px cursive";
        context.fillText("GoodCola", 318, 55);
        context.beginPath();
        context.shadowColor = context.strokeStyle = white;
        context.lineWidth = 2;
        context.lineCap = context.lineJoin = "round";
        context.rect(117, 60, 11, 1);
        context.rect(138, 60, 7, 1);
        context.rect(155, 60, 97, 1);
        context.stroke();

        // CTA
        context.beginPath();
        context.shadowColor = context.fillStyle = red;
        context.fillRect(583, 15, 130, 60);
        context.fillRect(583, 15, 130, 60);
        context.fillRect(583, 15, 130, 60);

        context.shadowColor = context.fillStyle = white;
        context.font = "bold 20px Helvetica, sans-serif";
        context.fillText("BUY NOW", 600, 53);

        // Logo
        context.beginPath();
        context.fillStyle = red;
        context.shadowColor = context.strokeStyle = white;
        context.lineWidth = 4;
        context.arc(45, 45, 30, 0, 2 * Math.PI, false);
        context.fill();
        context.stroke();
        context.stroke();
        context.stroke();

        context.beginPath();
        context.shadowColor = "none";
        context.fillStyle = red;
        context.arc(45, 45, 28, 0, 2 * Math.PI, false);
        context.fill();
        context.clip();
        context.beginPath();
        context.shadowColor = "transparent";
        context.strokeStyle = "yellow";
        context.moveTo(0, 60);
        context.quadraticCurveTo(30, 35, 50, 65);
        context.stroke();
        context.globalCompositeOperation = "destination-out";
        context.drawImage(face, 34, 16, 44, 60);
        context.globalCompositeOperation = "source-over";

        return canvas;
    }());


    function renderFlesh (fleshbase) {
        document.documentElement.style.background = flesh3d.style.background = fleshbase;

        fleshcontext.clearRect(0, 0, w, h);

        // Draw flesh base
        fleshcontext.fillStyle = fleshbase;
        fleshcontext.fillRect(0, 0, w, h);

        // Draw ad
        var ad = {
            width: w >= fleshad.width ? fleshad.width : (w - 40),
            height: w >= fleshad.width ? fleshad.height : ((fleshad.height / fleshad.width) * (w - 40)),
            left: w >= fleshad.width ? ((w - fleshad.width) / 2) : 20,
            top: h / 4
        };
        ad.top = h - ad.height - 20;
        fleshcontext.globalAlpha = 0.85;
        fleshcontext.drawImage(fleshad, ad.left, ad.top, ad.width, ad.height);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.fillStyle = "black";
        fleshcontext.font = "normal 13px Helvetica, sans-serif";
        fleshcontext.fillText("A message from our sponsors:", ad.left, ad.top - 5);

        // Draw leather-like creases
        Voronoi.preparePattern(fleshbase);
        fleshcontext.fillStyle = fleshcontext.createPattern(Voronoi.pattern.canvas, "repeat");
        fleshcontext.globalAlpha = 0.4;
        fleshcontext.fillRect(0, 0, w, h);
        fleshcontext.globalAlpha = 1.0;

        // Draw noise
        fleshcontext.globalCompositeOperation = "overlay";
        fleshcontext.globalAlpha = 0.1;
        fleshcontext.shadowColor = "rgba(255, 255, 255, 0.4)";
        fleshcontext.shadowBlur = 0.001;
        fleshcontext.shadowOffsetX = 1.0;
        fleshcontext.shadowOffsetY = 1.0;
        fleshcontext.drawImage(noise, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.shadowColor = null;
        fleshcontext.shadowBlur = null;
        fleshcontext.shadowOffsetX = null;
        fleshcontext.shadowOffsetY = null;
        fleshcontext.globalCompositeOperation = "source-over";

        // Draw marbling
        SNoise.render(function (data) {
            data.x /= w;
            data.y /= h;
            data.s = 10;
            data.no = SNoise.noise(data.s * data.x, (h / w * data.s) * data.y, 1) * 0.1 + 0.3;
            data.r = data.g = data.b = 255 * data.no;

            return data;
        });
        fleshcontext.globalAlpha = 0.15;
        fleshcontext.globalCompositeOperation = "soft-light";
        fleshcontext.drawImage(SNoise.context.canvas, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.globalCompositeOperation = "source-over";


        // Draw veins
        fleshcontext.globalAlpha = 0.3;
        fleshcontext.globalCompositeOperation = "overlay";
        fleshcontext.drawImage(veins.context.canvas, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.globalCompositeOperation = "source-over";

        // Draw moles / sun spots
        fleshcontext.globalAlpha = 0.6;
        fleshcontext.globalCompositeOperation = "soft-light";
        fleshcontext.drawImage(spots.context.canvas, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.globalCompositeOperation = "source-over";
    }

    function prepareNormalMap () {
        // This could use some cleaning up but overall it's not bad.

        // Courtesy of all kinds of reading:
        // http://www.fabiensanglard.net/bumpMapping/index.php
        // http://www.ozone3d.net/tutorials/bump_mapping_p4.php
        // http://stackoverflow.com/a/2368794
        // http://learnopengl.com/#!Advanced-Lighting/Normal-Mapping
        // http://www.pheelicks.com/2014/01/webgl-tombstone-bump-mapping/
        // https://github.com/mattdesl/lwjgl-basics/wiki/ShaderLesson6
        // http://math.hws.edu/graphicsbook/source/webgl/bumpmap.html
        // http://www.opengl-tutorial.org/intermediate-tutorials/tutorial-13-normal-mapping/
        // http://www.damix.it/public/webgl/normal-mapping.html
        // http://voxelent.com/html/beginners-guide/chapter_10/ch10_NormalMap.html

        normalcontext.clearRect(0, 0, w, h);
        normalcontext.shadowBlur =
            normalcontext.shadowColor =
            normalcontext.shadowOffsetX =
            normalcontext.shadowOffsetY = null;

        // Get that blueish
        normalcontext.globalCompositeOperation = "source-over";
        normalcontext.fillStyle = "rgba(127, 127, 255, 1)";
        normalcontext.fillRect(0, 0, w, h);

        // Leather
        normalcontext.globalAlpha = 0.6;
        normalcontext.fillStyle = normalcontext.createPattern(Voronoi.normal.canvas, "repeat");
        // normalcontext.fillRect(0, 0, w, h);
        normalcontext.fillRect(0, 0, w / 2, h);  // instead of filling a full rect of normal pattern,
        normalcontext.save();                    // which gets weaker as it approaches the right,
        normalcontext.scale(-1, 1);              // we fill the left half with strong normal,
        normalcontext.translate(-w / 2, 0);      // then we fill the right half with flipped normal
        normalcontext.fillRect(0, 0, -w / 2, h); // so that we can get the same(-ish) lighting there.
        normalcontext.restore();                 // A similar lhs/rhs thing is done for veins below.

        // Veins
        normalcontext.globalAlpha = 0.7;
        normalcontext.globalCompositeOperation = "overlay";
        normalcontext.shadowBlur = 0.5;
        normalcontext.shadowColor = "rgba(255, 127, 255, 1)";
        normalcontext.shadowOffsetX = 0.0;
        normalcontext.shadowOffsetY = -2.0;
        normalcontext.drawImage(veins.context.canvas, 0, 0, w / 2, h, 0, 0, w / 2, h);
        normalcontext.shadowOffsetY = 2.0;
        normalcontext.drawImage(veins.context.canvas, w / 2, 0, w / 2, h, w / 2, 0, w / 2, h);
        normalcontext.shadowColor = "rgba(127, 255, 127, 1)";
        normalcontext.shadowOffsetX = 1.0;
        normalcontext.shadowOffsetY = 4.0;
        normalcontext.drawImage(veins.context.canvas, 0, 0);

        //// Reset normalcontext
        normalcontext.globalAlpha = 1.0;
        normalcontext.globalCompositeOperation = "source-over";
        normalcontext.shadowColor = "white";
        normalcontext.shadowOffsetY = 20.0;
        normalcontext.shadowBlur = 20.0;
        normalcontext.drawImage(usercontext.canvas, 0, 0);
        normalcontext.shadowColor = "blue";
        normalcontext.shadowOffsetY = -20.0;
        normalcontext.drawImage(usercontext.canvas, 0, 0);
        normalcontext.shadowColor = normalcontext.shadowOffsetY = normalcontext.shadowOffsetX = null;
    }


    var fov = (smaller / bigger) * 100 * TO_RAD;
    var projection = m4.perspective(90 * TO_RAD, w / h, 0.5, bigger + 1);
    var target = v3.copy([0, 0, 0]);
    var eye = v3.copy([0, 0, -1]);
    var up = [0, 1, 0];
    var world;
    var rendering = false;
    function renderFlesh3D () {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // gl.enable(gl.DEPTH_TEST);
        // gl.enable(gl.CULL_FACE);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        m4.lookAt(eye, target, up, camera);
        m4.inverse(camera, view);
        m4.multiply(view, projection, viewProjection);

        world = skin.uniforms.u_world;
        m4.identity(world);
        m4.translate(world, skin.translation, world);
        m4.rotateX(world, -90 * TO_RAD, world);
        m4.rotateY(world, 180 * TO_RAD, world);
        m4.transpose(m4.inverse(world, skin.uniforms.u_worldInverseTranspose),
                skin.uniforms.u_worldInverseTranspose);
        m4.multiply(skin.uniforms.u_world, viewProjection, skin.uniforms.u_worldViewProjection);

        gl.bindBuffer(gl.ARRAY_BUFFER, tangentBuffer);
        gl.vertexAttribPointer(tangentLoc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(tangentLoc);


        gl.useProgram(programInfo.program);
        twgl.setBuffersAndAttributes(gl, programInfo, plane);
        twgl.setUniforms(programInfo, uniforms);
        twgl.drawBufferInfo(gl, gl.TRIANGLES, plane);
        rendering = false;

        // window.requestAnimationFrame(renderFlesh3D);
    }
    function prepareFlesh3D () {
        prepareNormalMap();
        twgl.setTextureFromElement(gl, bumpmap, fleshnormal);
        twgl.setTextureFromElement(gl, texture, fleshcontext.canvas);

        window.requestAnimationFrame(renderFlesh3D);
    }

    renderFlesh("#eebb99");
    prepareFlesh3D();

    var lastpos;
    function handleuser (e) {
        if (rendering) {
          return false;
        }

        rendering = true;
        var pos = {
            x: e.changedTouches ? e.changedTouches[0].clientX : e.clientX,
            y: e.changedTouches ? e.changedTouches[0].clientY : e.clientY
        };

        if (!lastpos) {
          lastpos = pos;
        }

        // slowly clear
        usercontext.globalCompositeOperation = "destination-out";
        usercontext.fillStyle = "rgba(0, 0, 0, 0.1)";
        usercontext.fillRect(0, 0, w, h);

        // draw lines
        usercontext.globalCompositeOperation = "source-over";
        usercontext.lineWidth = 10;
        usercontext.lineJoin = 'round';
        usercontext.lineCap = 'round';
        usercontext.strokeStyle = "rgba(127, 127, 255, 0.9)";
        usercontext.beginPath();
        usercontext.moveTo(lastpos.x, lastpos.y);
        usercontext.lineTo(pos.x, pos.y);
        usercontext.closePath();
        usercontext.stroke();

        lastpos = pos;

        window.requestAnimationFrame(prepareFlesh3D);
        e.preventDefault();
    }
    window.addEventListener("mousemove", handleuser, false);
    window.addEventListener("touchmove", handleuser, false);

    document.getElementById("menu").addEventListener("click", function (e) {
        var t = e.target || e.srcElement;
        if (t && t.nodeName.toLowerCase() === "span") {
            renderFlesh(t.getAttribute("data-color"));
            prepareFlesh3D();
        }
    });
}(window.twgl));
