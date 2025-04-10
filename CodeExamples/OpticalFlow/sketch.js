// https://kylemcdonald.github.io/cv-examples/
// create your own generative graphics
// replacing the code inside genGraphics
// feel free to use graphics from here:
// https://www.openprocessing.org/


let capture;
let previousPixels;
let flow;
let step = 8;
let totalPhase = 0;


////////////////////////////////////////////////////////
function setup() {
    createCanvas(640, 480);
    capture = createCapture(VIDEO);
    capture.size(640, 480);
    capture.hide();
    flow = new FlowCalculator(step);
}
////////////////////////////////////////////////////////
function same(a1, a2, stride, n) {
    for (let i = 0; i < n; i += stride) {
        if (a1[i] != a2[i]) {
            return false;
        }
    }
    return true;
}
////////////////////////////////////////////////////////
function draw() {
    capture.loadPixels();



    if (capture.pixels.length > 0) {
        if (previousPixels) {
            previousPixels.loadPixels();
            // cheap way to ignore duplicate frames
            if (same(previousPixels.pixels, capture.pixels, 4, width)) {
                return;
            }
            // calculate optical flow
            flow.calculate(previousPixels.pixels, capture.pixels, capture.width, capture.height);
        }else {
            previousPixels = createImage(capture.width, capture.height);
        }

        previousPixels.copy(capture, 0, 0, capture.width, capture.height, 0, 0, capture.width, capture.height);
        //draw frame of video to canvas
        image(capture, 0, 0);

        // code to visualise optical flow grid
        if (flow.flow && flow.flow.u != 0 && flow.flow.v != 0) {

            let gridThreshold = 10;//adjust this number to make it more or less sensitive to movement

            for (let i=0; i<flow.flow.zones.length; i++){
                zone = flow.flow.zones[i];

                if (abs(zone.u)>gridThreshold || abs(zone.v)>gridThreshold){ // only if movement is significant
                    stroke(map(zone.u, -step, +step, 0, 255),
                           map(zone.v, -step, +step, 0, 255), 128);
                    line(zone.x, zone.y, zone.x + zone.u, zone.y + zone.v);
                }
            }

            push();
            strokeWeight(2);
            stroke(255,0,0);
            translate(width/2, height/2);
            //show our avaerage direction
            line(0, 0, flow.flow.u*10, flow.flow.v*10);
            pop();


            //try switch out:
            //flow.flow.u is a left to right action (x axis)
            //flow.flow.v is the up and down action (y axis)
            totalPhase += flow.flow.u * 5;
        
            genGraphics(totalPhase);

            //text(frameRate(),10,10);
        }
    }


 
}
///////////////////////////////////////////////////////////////

function genGraphics(phase){
  let numOfRings = 10;
  let ringWidth = 20;
  let phaseDiff = 360/numOfRings;

  push();
  angleMode(DEGREES);
  translate(width/2, height/2);
  noFill();
  stroke(255);
  for (let i=1; i<numOfRings; i++){
    let p = phaseDiff*i + phase;
    let sW = (sin(p*2) + 1)/2 * (ringWidth-2) + 2
    strokeWeight(sW);
    ellipse(0, 0,  i * ringWidth*2,  i * ringWidth*2);
  }
  pop();
}
