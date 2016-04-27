/*jslint browser: true*/
(function () {
    "use strict";
    var flesh = document.getElementById("flesh");
    flesh.width = window.innerWidth;
    flesh.height = window.innerHeight;

    var fleshcontext = flesh.getContext("2d");

    var w = flesh.width,
        h = flesh.height,
        imgdata = fleshcontext.createImageData(w, h),
        buffer32 = new window.Uint32Array(imgdata.data.buffer),
        len = buffer32.length,
        i = 0;

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


    // Veins
    // kudos to https://lisimba.org/lichtenberg/lichtenberg-live.html
    var veincanvas = document.createElement("canvas");
    veincanvas.width = w;
    veincanvas.height = h;
    var veincanvascontext = veincanvas.getContext("2d");
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
                        ven.probableLinks.push(venules[ix - 1][iy - 1]);   // NW
                    }
                    ven.probableLinks.push(venules[ix - 1][iy]);   // W
                    if (iy < lastY) {
                        ven.probableLinks.push(venules[ix - 1][iy + 1]);   // SW
                    }
                }
                if (iy > 0) {
                    ven.probableLinks.push(venules[ix][iy - 1]);   // N
                }
                if (iy < lastY) {
                    ven.probableLinks.push(venules[ix][iy + 1]);   // S
                }
                if (ix < lastX) {
                    if (iy > 0) {
                        ven.probableLinks.push(venules[ix + 1][iy - 1]);   // NE
                    }
                    ven.probableLinks.push(venules[ix + 1][iy]);   // E
                    if (iy < lastY) {
                        ven.probableLinks.push(venules[ix + 1][iy + 1]);   // SE
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

                // Make a copy of the potential links list. We destroy the copy bit by bit below.
                ven.probableLinksRemaining = ven.probableLinks.slice(0);
            });
        });

        // Seen the contact node.
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
                // Have a look at this ven again some time later.
                activeVenules.push(ven);
            } // If no links were made then all surrounding vens have been seen, so this ven doesn't have to be active anymore. Just forget about it.
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

    function renderFlesh (fleshbase) {
        document.querySelector("html").style.background = fleshbase;

        fleshcontext.clearRect(0, 0, w, h);

        // Draw flesh base
        fleshcontext.fillStyle = fleshbase;
        fleshcontext.fillRect(0, 0, w, h);

        // Draw noise
        fleshcontext.globalCompositeOperation = "overlay";
        fleshcontext.globalAlpha = 0.2;
        fleshcontext.shadowColor = "rgba(255, 255, 255, 0.5)";
        fleshcontext.shadowBlur = 0.001;
        fleshcontext.shadowOffsetX = 1.0;
        fleshcontext.shadowOffsetY = 1.0;
        noisecontext.putImageData(imgdata, 0, 0);
        fleshcontext.drawImage(noise, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.shadowColor = null;
        fleshcontext.shadowBlur = null;
        fleshcontext.shadowOffsetX =null;
        fleshcontext.shadowOffsetY =null;
        fleshcontext.globalCompositeOperation = "source-over";

        // Draw crackle

        // Draw veins
        var veins = new VeinSet();
        fleshcontext.globalAlpha = 0.3;
        fleshcontext.globalCompositeOperation = "overlay";
        fleshcontext.drawImage(veins.context.canvas, 0, 0);
        fleshcontext.globalAlpha = 1.0;
        fleshcontext.globalCompositeOperation = "source-over";

        // Draw moles / sun spots
    }

    renderFlesh("#eebb99");

    document.getElementById("menu").addEventListener("click", function (e) {
        var t = e.target || e.srcElement;
        if (t && t.nodeName.toLowerCase() === "span") {
            renderFlesh(t.getAttribute("data-color"));
        }
    });
}());
