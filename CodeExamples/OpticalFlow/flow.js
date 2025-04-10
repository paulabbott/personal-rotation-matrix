// copied from https://github.com/anvaka/oflow

class FlowZone{
  constructor (x, y, u, v) {
    this.x = x;
    this.y = y;
    this.u = u;
    this.v = v;
  }
}

class FlowCalculator {
  constructor(step = 8) {
    this.step = step;
  }

  // assumes rgba images, but only uses one channel
  calculate (oldImage, newImage, width, height) {
    let zones = [];
    let step = this.step;
    let winStep = step * 2 + 1;

    let A2, A1B2, B1, C1, C2;
    let u, v, uu, vv;
    uu = vv = 0;
    let wMax = width - step - 1;
    let hMax = height - step - 1;
    let globalY, globalX, localY, localX;

    for (globalY = step + 1; globalY < hMax; globalY += winStep) {
      for (globalX = step + 1; globalX < wMax; globalX += winStep) {
        A2 = A1B2 = B1 = C1 = C2 = 0;

        for (localY = -step; localY <= step; localY++) {
          for (localX = -step; localX <= step; localX++) {
            let address = (globalY + localY) * width + globalX + localX;

            let gradX = (newImage[(address - 1) * 4]) - (newImage[(address + 1) * 4]);
            let gradY = (newImage[(address - width) * 4]) - (newImage[(address + width) * 4]);
            let gradT = (oldImage[address * 4]) - (newImage[address * 4]);

            A2 += gradX * gradX;
            A1B2 += gradX * gradY;
            B1 += gradY * gradY;
            C2 += gradX * gradT;
            C1 += gradY * gradT;
          }
        }

        let delta = (A1B2 * A1B2 - A2 * B1);

        if (delta !== 0) {
          /* system is not singular - solving by Kramer method */
          let Idelta = step / delta;
          let deltaX = -(C1 * A1B2 - C2 * B1);
          let deltaY = -(A1B2 * C2 - A2 * C1);

          u = deltaX * Idelta;
          v = deltaY * Idelta;
        } else {
          /* singular system - find optical flow in gradient direction */
          let norm = (A1B2 + A2) * (A1B2 + A2) + (B1 + A1B2) * (B1 + A1B2);
          if (norm !== 0) {
            let IGradNorm = step / norm;
            let temp = -(C1 + C2) * IGradNorm;

            u = (A1B2 + A2) * temp;
            v = (B1 + A1B2) * temp;
          } else {
            u = v = 0;
          }
        }

        if (-winStep < u && u < winStep &&
          -winStep < v && v < winStep) {
          uu += u;
          vv += v;
          zones.push(new FlowZone(globalX, globalY, u, v));
        }
      }
    }

    this.flow = {
      zones : zones,
      u : uu / zones.length,
      v : vv / zones.length
    };

    return this.flow;
  };
};