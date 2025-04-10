/*
Documentation:
https://docs.ml5js.org/#/reference/handpose?id=examples

This sketch is set up to do pinch detection on one hand

Pinch Detection:
We use debouncing to do a quick pinch click interaction
We wait for a few milliseconds before "clicking" / pinching
This helps with noisy input, like losing tracking of the fingers
https://medium.com/@jamischarles/what-is-debouncing-2505c0648ff1

*/

let handPose;
let video;
let hands = [];
let pinchTimeout;
let pinchStarted = false;
let randColor;
const timeToWait = 600; // 400 millis, keep it small but not too small

function preload() {
  //can set number of hands to detect
  let options = {
    maxHands: 1
  }
  handPose = ml5.handPose(options);
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);

  randColor = pickRandomColor();
}

function draw() {
  image(video, 0, 0, width, height);
  drawKeypoints();
  doPinch();

  // Circle that changes color on pinch
  fill(randColor);
  noStroke();
  circle(60, 60, 110);
}

function gotHands(results) {
  hands = results;
}

function doPinch() {
  if (hands.length > 0) {

    // Want to do a pinch detection of two hands?
    // change the options in set up to track 2 hands which will give two hands, 
    // but they control / can override the same pinch "event"
    // then try numPinchHands equals hands.length 
    let numPinchHands = 1; 

    for (let i = 0; i < numPinchHands; i++) {
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
        //Debouncing -> clear/cancel the timeout that will call the pinch if pinch ends before wait time
        if (pinchTimeout) clearTimeout(pinchTimeout);
        fill(0, 0, 255);
        ellipse(thumb.x, thumb.y, 20, 20);
      } else if (pinchStarted) {
        pinchStarted = false;
        //Debouncing -> call pinch function after short time
        pinchTimeout = window.setTimeout(pinch, timeToWait);
        console.log("Pinch detected!");
      }
    }

  } else {
    pinchStarted = false;
    if (pinchTimeout) clearTimeout(pinchTimeout);
  }
}

function pinch() {
  randColor = pickRandomColor();
  console.log("Pinch Event");
}

function pickRandomColor() {
  return color(random(255), random(255), random(255));
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

