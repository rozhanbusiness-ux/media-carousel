import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1040, H = 300;
const GOLD = '#C9992E';
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

ctx.strokeStyle = GOLD;
ctx.fillStyle = GOLD;
ctx.lineJoin = 'miter';
ctx.miterLimit = 12;
ctx.lineCap = 'butt';

const stroke = (w, pts, curve) => {
  ctx.lineWidth = w;
  ctx.beginPath();
  if (curve) {
    curve(ctx);
  } else {
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  }
  ctx.stroke();
};

// M — two angular mountain peaks
stroke(38, [[50, 240], [110, 70], [165, 162], [220, 70], [280, 240]]);

// E — mirrored (brand style)
stroke(34, [[458, 70], [458, 240]]);
stroke(34, [[458, 70], [345, 70]]);
stroke(34, [[458, 155], [365, 155]]);
stroke(34, [[458, 240], [345, 240]]);

// D — stem + bowl
stroke(34, [[515, 70], [515, 240]]);
stroke(34, null, (c) => {
  c.moveTo(515, 70);
  c.bezierCurveTo(620, 70, 650, 110, 650, 155);
  c.bezierCurveTo(650, 200, 620, 240, 515, 240);
});

// I
stroke(34, [[705, 70], [705, 240]]);

// A — peak + crossbar
stroke(38, [[770, 240], [878, 62], [986, 240]]);
stroke(26, [[820, 180], [936, 180]]);

mkdirSync('public', { recursive: true });
writeFileSync('public/logo.png', canvas.toBuffer('image/png'));
console.log('Wrote public/logo.png', W + 'x' + H);
