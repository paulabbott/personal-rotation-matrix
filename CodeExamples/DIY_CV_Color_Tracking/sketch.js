/*
Threshold example setting pixel to black or white if 
grey scale is above a threshold level. 
Adapted from: https://kylemcdonald.github.io/cv-examples/

*/

//const means a contstant value, you cannot reset the value later in the sketch
const VID_WIDTH = 640;
const VID_HEIGHT = 480;

let video;
let threshold = 50;//brightness threshold

let trailPointsLength = 100;
let trailPoints = [];
let sumPosition;

let slider;

let targetColor = [255, 255, 255];

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO);
  video.size(VID_WIDTH,VID_HEIGHT);
  // createvideo actually makes a separate video element
  // on the page. uncomment line below to hide it.
  video.hide();

  //threshold slider
  slider = createSlider(0, 255, 20);//default start position is 20
  slider.position(10,VID_HEIGHT + 10);
  slider.size(100);

  sumPosition = createVector(0, 0);
}


function draw() {
  video.loadPixels();
  let sampling = false;

  if (video.pixels.length > 0) { // don't forget this!

    //sample color to track
    if (mouseIsPressed &&
      mouseX > 0 && mouseX < width &&
      mouseY > 0 && mouseY < height) {
      targetColor = video.get(mouseX, mouseY);
      sampling = true;
    }

    let pixels = video.pixels;

    // sldier val is 255 multiplied by three because we will be getting distance for 3 color channels
    threshold = slider.value()*3; 

    let total = 0;
    for (let y = 0; y < VID_HEIGHT; y++) {
      for (let x = 0; x < VID_WIDTH; x++) {

        let pixIndex = ((y*VID_WIDTH)+x)*4; //formula to get pixel index

        //difference between pixel color and target color, not computationally expensive to do it this way
        let diff =
            Math.abs(pixels[pixIndex] - targetColor[0]) +
            Math.abs(pixels[pixIndex + 1] - targetColor[1]) +
            Math.abs(pixels[pixIndex + 2] - targetColor[2]);

        // let diff = dist(pixels[pixIndex], targetColor[0],pixels[pixIndex + 1],targetColor[1],pixels[pixIndex + 2], targetColor[2]);
        
        //creating binarised black and white output to show tracking threshold
        let outputValue = 0;
        //if the distance/difference between color and target color is less than threshold
        if (diff < threshold) {
          outputValue = 255;
          sumPosition.x += x;//add position of x to total 
          sumPosition.y += y;//add position of y to total 
          total++;
        }

        pixels[pixIndex] = outputValue; // set red channel
        pixels[pixIndex + 1] = outputValue; // set green
        pixels[pixIndex + 2] = outputValue; // set blue
      }
    }

    //Average position = division of sum of positions by total number of tracked pixels
    if(total > 0){
      sumPosition.div(total);//vector math divitions
    }
  
  }
  if (!sampling) {
    video.updatePixels();
  }

  image(video, 0, 0, video.width, video.height);

  console.log(slider.value()*3);

  //Target Color Block
  noStroke();
  fill(targetColor);
  rect(20, VID_HEIGHT - 60, 40, 40);

  fill(255);
  text(round(frameRate(),2),20,VID_HEIGHT - 70);

  //current point
  stroke(255,0,0);
  strokeWeight(4);
  ellipse(sumPosition.x, sumPosition.y, 8, 8);

  //trail of previous points
  noFill();
  stroke(targetColor);
  strokeWeight(8);
  drawTrail(sumPosition);
}

function drawTrail(point) {
  let nextPoint = point.copy();//copy vector to new vector so we can store it
  
  trailPoints.push(nextPoint);//push next point into array

  //if we have more points than we want to track
  if (trailPoints.length > trailPointsLength) {
      trailPoints.shift();//remove from the front
  }

  //draw points
  beginShape();
  for(let i = 0; i < trailPoints.length; i++){
    vertex(trailPoints[i].x, trailPoints[i].y);
  }
  endShape();
}


function windowResized() {
  //resize our canvas to the width and height of our browser window
  // resizeCanvas(windowWidth, windowHeight);
}