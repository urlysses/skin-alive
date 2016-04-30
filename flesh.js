/*jslint browser: true*/
(function () {
    "use strict";
    var flesh = document.getElementById("flesh");
    flesh.width = window.innerWidth;
    flesh.height = window.innerHeight;

    var fleshcontext = flesh.getContext("2d");

    var w = flesh.width,
        h = flesh.height,
        i = 0;

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
        var ca = document.createElement("canvas");
        ca.width = Math.round(this.context.canvas.width / 2);
        ca.height = Math.round(this.context.canvas.height / 2);
        var context = ca.getContext("2d");

        // Fill pattern with skin tone
        context.fillStyle = fleshbase;
        context.fillRect(0, 0, w, h);

        // draw once for lighting
        context.globalCompositeOperation = "overlay";
        context.globalAlpha = 0.35;
        context.shadowColor = "rgba(255, 255, 255, 0.5)";
        context.shadowBlur = 1.0;
        context.shadowOffsetX = 0.0;
        context.shadowOffsetY = 2.0;
        context.drawImage(this.context.canvas, 0, 0, ca.width, ca.height);

        // draw again for lines
        context.globalCompositeOperation = "multiply";
        context.globalAlpha = 0.03;
        context.shadowColor = "rgba(0, 0, 0, 0.7)";
        context.shadowBlur = 0.001;
        context.shadowOffsetX = 0.0;
        context.shadowOffsetY = -3.0;
        context.drawImage(this.context.canvas, 0, 0, ca.width, ca.height);

        // reset context
        context.globalAlpha = 1.0;
        context.shadowColor = null;
        context.shadowBlur = null;
        context.shadowOffsetX = null;
        context.shadowOffsetY = null;
        context.globalCompositeOperation = "source-over";

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


    function renderFlesh (fleshbase) {
        document.querySelector("html").style.background = fleshbase;

        fleshcontext.clearRect(0, 0, w, h);

        // Draw flesh base
        fleshcontext.fillStyle = fleshbase;
        fleshcontext.fillRect(0, 0, w, h);

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
            data.s = 20;
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
        var veins = new VeinSet();
        fleshcontext.globalAlpha = 0.3;
        fleshcontext.globalCompositeOperation = "overlay";
        fleshcontext.drawImage(veins.context.canvas, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.globalCompositeOperation = "source-over";

        // Draw moles / sun spots
        var spots = new SpotSet();
        fleshcontext.globalAlpha = 0.6;
        fleshcontext.globalCompositeOperation = "soft-light";
        fleshcontext.drawImage(spots.context.canvas, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.globalCompositeOperation = "source-over";
    }

    renderFlesh("#eebb99");

    // To 3D-ify it? http://jsfiddle.net/loktar/4qAxZ/

    document.getElementById("menu").addEventListener("click", function (e) {
        var t = e.target || e.srcElement;
        if (t && t.nodeName.toLowerCase() === "span") {
            renderFlesh(t.getAttribute("data-color"));
        }
    });
}());
