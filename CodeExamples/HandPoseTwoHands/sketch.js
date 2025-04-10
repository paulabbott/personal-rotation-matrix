/*
Documentation:
https://docs.ml5js.org/#/reference/handpose?id=examples

This sketch is to show two hand tracking, drawing a line between  
pinched fingers on two hands

*/

let handPose;
let video;
let hands = [];
let handsLine = []; 
let loaded = false;


function preload() {
  //can set number of hands to detect
  let options = {
    maxHands: 2,
    flipped: true // make it like a mirror 
  }
  handPose = ml5.handPose(options);
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO, { flipped: true }); //make it like a mirror
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);

  // Create p5.Vector for each point in a line
  let p1 = createVector(random(width), random(height));
  let p2 = createVector(random(width), random(height));
  
  handsLine.push(p1);
  handsLine.push(p2);
}

function draw() {

  image(video, 0, 0, width, height);

  drawKeypoints();
  drawHandsLine();

  // Circle that changes color on pinch
  stroke(255,0,0);
  strokeWeight(8);
  line(handsLine[0].x,handsLine[0].y,handsLine[1].x,handsLine[1].y,);
}

function gotHands(results) {
  hands = results;
}

function drawHandsLine() {

  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    let keypoints = hand.keypoints;
    let indexF = keypoints[8]; // Index finger tip
    let thumb = keypoints[4]; // Thumb tip

    fill(255, 255, 0);
    noStroke();
    ellipse(indexF.x, indexF.y, 10, 10);
    fill(255, 0, 0);
    ellipse(thumb.x, thumb.y, 10, 10);

    //measure distance between thumb and index finger
    let pinchDist = dist(thumb.x, thumb.y, indexF.x, indexF.y);
    
    //get the distance between the top and bottom of the palm to give us an estimate of how far the hand is from the camera
    let avgHandSize = dist(keypoints[0].x, keypoints[0].y, keypoints[9].x, keypoints[9].y);
    let zOffset = map(avgHandSize, 50, 200, 20, 80); // Dynamically adjust based on hand size
    // console.log(zOffset);

    // zOffset is acting as our threshold value to determine if a pinch has happened
    if (pinchDist < zOffset) {
      pinchStarted = true;
      fill(0, 0, 255);
      ellipse(thumb.x, thumb.y, 20, 20);

      //we are using the number of hand in the hands array to control which point on our line is moved 
      handsLine[i].x = thumb.x;
      handsLine[i].y = thumb.y;

    } 
  }


}

function drawKeypoints() {
  // loop through key points on each hand and draw a circle at each point
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(0, 255, 0);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }
}

