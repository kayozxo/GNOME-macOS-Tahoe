/* utils.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 * author: neuromorph
 */

/* exported all functions  */


// Brightness of color in terms of HSP value
export function getHSP(color, g, b) {
    let r;
    if(g)
        r = color;
    else
        [r, g, b] = [color[0], color[1], color[2]];
    // HSP equation for perceived brightness from http://alienryderflex.com/hsp.html
    let hsp = Math.sqrt(
        0.299 * (r * r) +
        0.587 * (g * g) +
        0.114 * (b * b)
    );
    return hsp;
}

// Compare colors by HSP values
export function compareHSP(A, B) {
    let hspA = getHSP(parseInt(A[0]), parseInt(A[1]), parseInt(A[2]));
    let hspB = getHSP(parseInt(B[0]), parseInt(B[1]), parseInt(B[2]));

    return (hspA < hspB)? -1 : (hspA > hspB)? 1 : 0;
}

// Move color A towards or away from B by 'factor'. Based on simplified formula from getColorDist() below
export function colorMove(A, B, factor) {
    let [r1, g1, b1] = [parseInt(A[0]), parseInt(A[1]), parseInt(A[2])];
    let [r2, g2, b2] = [parseInt(B[0]), parseInt(B[1]), parseInt(B[2])];

    let r = (r2 - r1);
    let g = (g2 - g1);
    let b = (b2 - b1);
    if(r==0 && factor < 0)
        r = factor*255;
    if(g==0 && factor < 0)
        g = factor*255;
    if(b==0 && factor < 0)
        b = factor*255;

    let rmean = (r1 + r2)/2;
    let rFactor = Math.sqrt((512 + rmean)/ 256);
    let gFactor = 2;
    let bFactor = Math.sqrt((767 - rmean)/ 256);
    let sumFactor = rFactor + gFactor + bFactor;

    let rMove = r * factor * rFactor / sumFactor;
    let gMove = g * factor * gFactor / sumFactor;
    let bMove = b * factor * bFactor / sumFactor;

    let newR = (r1 + rMove);
    let newG = (g1 + gMove);
    let newB = (b1 + bMove);
    newR = newR>255? 255 : newR<0? 0 : parseInt(newR);
    newG = newG>255? 255 : newG<0? 0 : parseInt(newG);
    newB = newB>255? 255 : newB<0? 0 : parseInt(newB);

    // dlog('COLOR MOVE - ' + A + ' - ' + B + ' - ' + newR + ' ' + newG + ' ' + newB);
    return [String(newR), String(newG), String(newB)];
}

// Distance between two colors in weighted RGB space
export function getColorDist(A, B) {
    let [r1, g1, b1] = [parseInt(A[0]), parseInt(A[1]), parseInt(A[2])];
    let [r2, g2, b2] = [parseInt(B[0]), parseInt(B[1]), parseInt(B[2])];

    let rmean = (r1 + r2)/2;
    let r = r1 - r2;
    let g = g1 - g2;
    let b = b1 - b2;
    // Approx color distance based on http://www.compuphase.com/cmetric.htm, range: 0-765
    let dist =  Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
    // dlog('COLOR DIST - ' + A + ' , ' + B + ' - ' + dist);
    return dist/3; // range: 0-255
}

export function getColorfulness(color) {
    // We consider greater difference between the R, G, B values to indicate colorfulness
    // while similar values for R,G,B to indicate greyscale
    let [r, g, b] = [parseInt(color[0]), parseInt(color[1]), parseInt(color[2])];
    let colorfulness = Math.max(r, g, b) - Math.min(r, g, b);
    return colorfulness;
}
export function compareColorfulness(A, B) {
    let colorDistA = getColorfulness(A);
    let colorDistB = getColorfulness(B);
    return (colorDistA < colorDistB)? -1 : (colorDistA > colorDistB)? 1 : 0;
}

// Compare colorfulness using saturation
export function compareSaturation(A, B) {
    // Convert the colors into HSL to sort by Saturation
    let hslA = rgbToHsl(A);
    let hslB = rgbToHsl(B);
    return (hslA[1] < hslB[1])? -1 : (hslA[1] > hslB[1])? 1 : 0;
}

export function compareLightness(A, B) {
    // Convert the colors into HSL to sort by Lightness
    let hslA = rgbToHsl(A);
    let hslB = rgbToHsl(B);
    return (hslA[2] < hslB[2])? -1 : (hslA[2] > hslB[2])? 1 : 0;
}

// Convert to String in 0-1 range to store in gsettings
export function getStrv(strInt) {
    // Color settings are stored as RGB in range 0-1 so we convert from 0-255
    let [r, g, b] = [parseInt(strInt[0]), parseInt(strInt[1]), parseInt(strInt[2])];
    return [(r/255).toFixed(3), (g/255).toFixed(3), (b/255).toFixed(3)];
}

// Convert from color array to rgb string
export function getRGBStr(str255) {
    let rgb = `rgb(${str255[0]}, ${str255[1]}, ${str255[2]})`;
    return rgb;
}

// Converts RGB to HSL space
export function rgbToHsl(rgb) {
    let [r, g, b] = [rgb[0]/255, rgb[1]/255, rgb[2]/255];
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if(max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l]; // h, s, l in range 0 - 1
}

// Converts HSL to RGB space
export function hslToRgb(hsl) {
    let [h, s, l] = hsl;
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
}

// Convert RGB to CIELAB space
export function rgbToLab(rgbColor) {
    const [r, g, b] = rgbColor.map(val => {
        val /= 255;
        return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
    const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    const z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;

    const epsilon = 0.008856; // 6/29
    const kappa = 903.3; // 24389/27

    const fx = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
    const fy = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
    const fz = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bb = 200 * (fy - fz);

    return [L, a, bb];
}

// Compute distance between two colors in CIELAB space (OLD, check ΔE00 below)
export function colorDistance(color1, color2) {
    const lab1 = rgbToLab(color1);
    const lab2 = rgbToLab(color2);

    const deltaL = lab1[0] - lab2[0];
    const deltaA = lab1[1] - lab2[1];
    const deltaB = lab1[2] - lab2[2];

    return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

// Calculate CIELAB color difference 2000 (ΔE00)
export function colorDistance2000(color1, color2) {
    const lab1 = rgbToLab(color1);
    const lab2 = rgbToLab(color2);

    const deltaL = lab2[0] - lab1[0];
    const meanL = (lab1[0] + lab2[0]) / 2;

    const C1 = Math.sqrt(lab1[1] * lab1[1] + lab1[2] * lab1[2]);
    const C2 = Math.sqrt(lab2[1] * lab2[1] + lab2[2] * lab2[2]);
    const meanC = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Math.pow(meanC, 7) / (Math.pow(meanC, 7) + Math.pow(25, 7))));

    const a1Prime = (1 + G) * lab1[1];
    const a2Prime = (1 + G) * lab2[1];

    const C1Prime = Math.sqrt(a1Prime * a1Prime + lab1[2] * lab1[2]);
    const C2Prime = Math.sqrt(a2Prime * a2Prime + lab2[2] * lab2[2]);
    const meanCPrime = (C1Prime + C2Prime) / 2;

    const h1Prime = (Math.atan2(lab1[2], a1Prime) * 180) / Math.PI + (lab1[2] < 0 ? 360 : 0);
    const h2Prime = (Math.atan2(lab2[2], a2Prime) * 180) / Math.PI + (lab2[2] < 0 ? 360 : 0);

    let deltaHPrime;
    if (Math.abs(h1Prime - h2Prime) <= 180) {
        deltaHPrime = h2Prime - h1Prime;
    } else if (h2Prime <= h1Prime) {
        deltaHPrime = h2Prime - h1Prime + 360;
    } else {
        deltaHPrime = h2Prime - h1Prime - 360;
    }

    const deltaHPrimeMean = (Math.abs(h1Prime - h2Prime) <= 180) ? h1Prime + h2Prime / 2 : (h1Prime + h2Prime + 360) / 2;

    const T = 1 - 0.17 * Math.cos((deltaHPrimeMean - 30) * (Math.PI / 180)) + 0.24 * Math.cos(2 * deltaHPrimeMean * (Math.PI / 180)) + 0.32 * Math.cos((3 * deltaHPrimeMean + 6) * (Math.PI / 180)) - 0.20 * Math.cos((4 * deltaHPrimeMean - 63) * (Math.PI / 180));
    const deltaTheta = 30 * Math.exp(-((deltaHPrimeMean - 275) / 25) * ((deltaHPrimeMean - 275) / 25));
    const R_C = 2 * Math.sqrt(Math.pow(meanCPrime, 7) / (Math.pow(meanCPrime, 7) + Math.pow(25, 7)));
    const S_L = 1 + (0.015 * Math.pow(meanL - 50, 2)) / Math.sqrt(20 + Math.pow(meanL - 50, 2));
    const S_C = 1 + 0.045 * meanCPrime;
    const S_H = 1 + 0.015 * meanCPrime * T;

    const R_Term = -Math.sin((2 * deltaTheta) * (Math.PI / 180)) * R_C;

    const L_Diff = deltaL / (S_L);
    const C_Diff = (C1Prime - C2Prime) / (S_C);
    const H_Diff = (deltaHPrime - R_Term) / (S_H);

    return Math.sqrt(L_Diff * L_Diff + C_Diff * C_Diff + H_Diff * H_Diff);
}

// Add tint to RGB color
export function addTint(rgbColor, amount) {
    const [r, g, b] = rgbColor.map(val => val + (255 - val) * amount);
    return [r, g, b];
}

// Add shade to RGB color - modified (grey)
export function addShade(rgbColor, amount, target=0) {
    const [r, g, b] = rgbColor.map(val => val + (target - val) * amount);
    return [r, g, b];
}

// Add tone to RGB color
export function addTone(rgbColor, amount) {
    const [r, g, b] = rgbColor.map(val => val + (128 - val) * amount);
    return [r, g, b];
}

// Convert RGB color to pastel color
export function addPastel(rgbColor, amount) {
    const hslColor = rgbToHsl(rgbColor);

    // Decrease saturation and increase lightness
    const pastelHslColor = [hslColor[0], hslColor[1] * amount, hslColor[2] * (1 + (1 - amount) / 2)];

    // Convert pastel HSL color back to RGB
    const pastelRgbColor = hslToRgb(pastelHslColor);

    return pastelRgbColor;
}

// Calculate relative luminance
export function relativeLuminance(color) {
    const [r, g, b] = color.map(val => {
        val /= 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors
export function contrastRatio(color1, color2) {
    const luminance1 = relativeLuminance(color1);
    const luminance2 = relativeLuminance(color2);

    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);

    return (lighter + 0.05) / (darker + 0.05); // Adding 0.05 to prevent division by zero
}

// Called separately for R,G and B. Moves startColor towards or away from endColor
export function colorMix(startColor, endColor, factor) {
    let color = startColor + factor*(endColor - startColor);
    color = (color < 0)? 0: (color>255)? 255: parseInt(color);
    return color;
}

// Blend 2 colors: similar to 'Shade' comment below
export function colorBlend(c0, c1, p) {
    var i=parseInt,r=Math.round,P=1-p,[a,b,c,d]=c0.split(","),[e,f,g,h]=c1.split(","),x=d||h,j=x?","+(!d?h:!h?d:r((parseFloat(d)*P+parseFloat(h)*p)*1000)/1000+")"):")";
    return"rgb"+(x?"a(":"(")+r(i(a[3]=="a"?a.slice(5):a.slice(4))*P+i(e[3]=="a"?e.slice(5):e.slice(4))*p)+","+r(i(b)*P+i(f)*p)+","+r(i(c)*P+i(g)*p)+j;
}

// Shade darken/lighten (e.g. p=0.2): rgb(Math.round(parseInt(r)*0.8 + 255*0.2)),...(Lighten: take 0.8 of C and add 0.2 of white, Darken: just take 0.8 of C)
export function colorShade(c, p) {
    var i=parseInt,r=Math.round,[a,b,c,d]=c.split(","),P=p<0,t=P?0:255*p,P=P?1+p:1-p;
    return"rgb"+(d?"a(":"(")+r(i(a[3]=="a"?a.slice(5):a.slice(4))*P+t)+","+r(i(b)*P+t)+","+r(i(c)*P+t)+(d?","+d:")");
}

// Check if Dark or Light color as per HSP threshold
export function getBgDark(r, g, b) {
    let hsp = getHSP(r, g, b);
    if(hsp > 155)
        return false;
    else
        return true;
}

// Convert hex color to RGB array
export function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
}

// Convert RGB to hex color
export function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}