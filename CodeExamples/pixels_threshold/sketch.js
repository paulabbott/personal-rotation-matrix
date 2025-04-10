/*
Threshold example setting pixel to black or white if 
grey scale is above a threshold level. 

*/

//const means a contstant value, you cannot reset the value later in the sketch
const VID_WIDTH = 640;
const VID_HEIGHT = 480;

let video;
let threshold = 50;//brightness threshold

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO);
  video.size(VID_WIDTH,VID_HEIGHT);
  // createCapture actually makes a separate video element
  // on the page. uncomment line below to hide it.
  video.hide();
}

function draw() {
  background(255);

  video.loadPixels();
  threshold = map(mouseX, 0, width,0,255);

  //jump through pixels of video 
  for(let x = 0; x < VID_WIDTH; x+=1){
    for(let y = 0; y < VID_HEIGHT; y+=1){
    
      let pixIndex = ((y*VID_WIDTH)+x)*4;//formula to get pixel index

      //first three channels are for rgb
      let r = video.pixels[pixIndex];
      let g = video.pixels[pixIndex+1];
      let b = video.pixels[pixIndex+2];

      //quick grey scale calculation, average of the three values give grey scale
      let grey = (r + b + g) / 3;

      let binary;
      //if brigthness is brighter than threshold
      if(grey > threshold){
        binary = 255;//set to white
      }else{
        binary = 0;//otherwise set to black
      }

      //change value of pixels to make black and white binarised image 
      video.pixels[pixIndex] = binary;
      video.pixels[pixIndex+1] = binary;
      video.pixels[pixIndex+2] = binary;

    }
  }

  //Update video pixels
  video.updatePixels();

  //if you want to scale height with correct aspect ratio to width of canvas
  let vidScale = VID_HEIGHT/VID_WIDTH;
  image(video, 0, 0, width, width*vidScale);

  fill(0);
  text("MouseX changes threshold: "+round(threshold),20,20);
  text("Frame Rate: "+round(frameRate(),2),20,40);

}

function windowResized() {
  //resize our canvas to the width and height of our browser window
  // resizeCanvas(windowWidth, windowHeight);
}
