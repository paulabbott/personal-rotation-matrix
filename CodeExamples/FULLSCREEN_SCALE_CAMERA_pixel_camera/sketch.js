/*
this shows how you should go about making your pixel effects full screen. 

DON'T just make your video bigger, this will slow your framerate! Scale up the graphics instead.

Camera: https://p5js.org/reference/p5/createCapture/ 
Makes a DOM element (more on this later): 
https://p5js.org/reference/p5/p5.MediaElement/ 

We get each frame from the video as an image 
and that is how we get the pixel information:
https://p5js.org/reference/p5/p5.Image/ 
https://p5js.org/reference/p5.Image/pixels/ 


*/

//const means a contstant value, you cannot reset the value later in the sketch
const VID_WIDTH = 320;
const VID_HEIGHT = 240;
const PIXEL_JUMP = 10;

let video;
let drawScale;

let numSampledPix;

let backGroundColor;

let avgHue;
let avgBrightness;
let avgSat;

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(VID_WIDTH,VID_HEIGHT);
  // The above function actually makes a separate video
  // element on the page. uncomment line below to hide it 
  video.hide();

  numSampledPix = (VID_WIDTH/PIXEL_JUMP) * (VID_HEIGHT/PIXEL_JUMP);

  backGroundColor = color(220);

  setScale();
}

function draw() {
  background(backGroundColor);
  fill(0);
 

  video.loadPixels();

  avgHue = 0;
  avgBrightness = 0;
  avgSat = 0;

  noStroke();

  push();
  translate(width/2,height/2);
  scale(drawScale);
  translate(-(VID_WIDTH/2),-(VID_HEIGHT/2));

  for(let x = 0; x < VID_WIDTH; x+=PIXEL_JUMP){
    for(let y = 0; y < VID_HEIGHT; y+=PIXEL_JUMP){
    
      let pixIndex = ((y*VID_WIDTH)+x)*4;

      let r = video.pixels[pixIndex];
      let g = video.pixels[pixIndex+1];
      let b = video.pixels[pixIndex+2];

      colorMode(RGB,255);
      let c = color(r,g,b);

      fill(r,g,b);
      let centerPoint = PIXEL_JUMP/2;
      ellipse(x+centerPoint,y+centerPoint,PIXEL_JUMP,PIXEL_JUMP);

      colorMode(HSB,100);
      avgHue += hue(c);
      avgBrightness += brightness(c);
      avgSat += saturation(c);

    }
  }

  //average of pixels sampled in nested for loop
  avgHue /= numSampledPix; 
  avgBrightness /= numSampledPix; 
  avgSat /= numSampledPix;

  let colorAngle = map(avgHue,0,100,0,360);
  let complimentaryAngle = (colorAngle + 180.0)%360;
  let compHue = map(complimentaryAngle,0,360,0,100);
  backGroundColor = color(compHue,avgSat,avgBrightness);

  fill(avgHue,avgSat,avgBrightness);
  rect(VID_WIDTH*0.5-50,50,50,50);
  fill(compHue,avgSat,avgBrightness);
  rect(VID_WIDTH*0.5,50,50,50);
  console.log(complimentaryAngle,round(avgHue),round(compHue));

  pop();


  text(round(frameRate(),2),20,20);

}


//event listener function runs every time browser window resized
function windowResized() {
  //resize our canvas to the width and height of our browser window
  resizeCanvas(windowWidth, windowHeight);
  setScale();
}

function setScale(){
  let videoRatio = VID_WIDTH/VID_HEIGHT;
  let windowRatio = width/height;

  //TWO OPTIONS:
  //try this in the if statement conditional to always fit whole image on screen
  //videoRatio >= windowRatio
  //this favours filling screen and crops the image
  // windowRatio >= videoRatio

  if(windowRatio >= videoRatio){
    drawScale = width/VID_WIDTH;
  }else{
    drawScale = height/VID_HEIGHT;
  }
}

function keyPressed() {
  //toggle fullscreen on or off
  if (key == 'f') {

    //get current full screen state https://p5js.org/reference/#/p5/fullscreen
    let fs = fullscreen();

    //switch it to the opposite of current value
    console.log("Full screen getting set to: " + !fs);
    fullscreen(!fs);
  }

}