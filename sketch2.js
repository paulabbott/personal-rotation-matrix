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
let zOffsetBuffers = [[], []]; // Buffers for smoothing zOffset values
const SMOOTHING_WINDOW_SIZE = 5; // Size of the smoothing window
let gridState = Array(4).fill().map(() => Array(4).fill(false)); // 4x4 grid
let squareX, squareY, gridSize; // Declare as global variables
let pinchActive = [false, false]; // Array to track pinch state for each hand
let pinchDistBuffers = [[], []]; // Buffers for smoothing pinchDist values
let initialAngles = [null, null]; // Array to store initial angles for each hand
let angleBuffers = [[], []]; // Buffers for smoothing angle changes
const ANGLE_SMOOTHING_WINDOW_SIZE = 5; // Size of the smoothing window


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
}

function draw() {
  image(video, 0, 0, width, height);
  drawGrid();
  for (let i = 0; i < hands.length; i++) {
    drawHandKeypoints(hands[i]);
    drawHandLines(hands[i], i);
    calculateAndDisplayValues(hands[i], i);
  }
}

function gotHands(results) {
  hands = results;
}

function getGridCellIndex(x, y, squareX, squareY, gridSize) {
  let col = Math.floor((x - squareX) / gridSize);
  let row = Math.floor((y - squareY) / gridSize);
  return { row, col };
}

function drawGrid() {
  // Draw a white opaque square in the center
  let squareSize = height - 80; // 40px away from top and bottom
  squareX = (width - squareSize) / 2;
  squareY = 40;
  gridSize = squareSize / 4;

  // Draw grid with highlighted cells
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (gridState[i][j]) {
        fill(255, 0, 0, 150); // Highlight color
      } else {
        fill(255, 255, 255, 200); // Default color
      }
      rect(squareX + j * gridSize, squareY + i * gridSize, gridSize, gridSize);
    }
  }

  // Subdivide the square into a 4x4 grid with light grey lines
  stroke(200); // Light grey color
  strokeWeight(1);
  for (let i = 1; i < 4; i++) {
    // Vertical lines
    line(squareX + i * gridSize, squareY, squareX + i * gridSize, squareY + squareSize);
    // Horizontal lines
    line(squareX, squareY + i * gridSize, squareX + squareSize, squareY + i * gridSize);
  }
}

function drawHandKeypoints(hand) {
  for (let j = 0; j < hand.keypoints.length; j++) {
    let keypoint = hand.keypoints[j];
    fill(128, 128, 128);
    noStroke();
    circle(keypoint.x, keypoint.y, 10);
  }
}

function drawHandLines(hand, i) {
  let keypoints = hand.keypoints;
  let indexF = keypoints[8]; // Index finger tip
  let thumb = keypoints[4]; // Thumb tip

  fill(255, 255, 0, 127); // Yellow with 50% opacity
  noStroke();
  ellipse(indexF.x, indexF.y, 10, 10);
  fill(255, 0, 0, 127); // Red with 50% opacity
  ellipse(thumb.x, thumb.y, 10, 10);

  // Draw a line between the thumb and index finger
  stroke(0, 255, 0);
  strokeWeight(2);
  line(thumb.x, thumb.y, indexF.x, indexF.y);

  // Calculate the midpoint
  let midX = (thumb.x + indexF.x) / 2;
  let midY = (thumb.y + indexF.y) / 2;

  //get the distance between the top and bottom of the palm to give us an estimate of how far the hand is from the camera
  let avgHandSize = dist(keypoints[0].x, keypoints[0].y, keypoints[9].x, keypoints[9].y);
  let zOffset = map(avgHandSize, 50, 200, 20, 80); // Dynamically adjust based on hand size

  // Add zOffset to the buffer and maintain the buffer size
  zOffsetBuffers[i].push(zOffset);
  if (zOffsetBuffers[i].length > SMOOTHING_WINDOW_SIZE) {
    zOffsetBuffers[i].shift();
  }

  // Calculate the smoothed zOffset
  let smoothedZOffset = zOffsetBuffers[i].reduce((sum, val) => sum + val, 0) / zOffsetBuffers[i].length;

  // Pass midX and midY to calculateAndDisplayValues
  calculateAndDisplayValues(hand, i, midX, midY);
}

function calculateAndDisplayValues(hand, i, midX, midY) {
  let keypoints = hand.keypoints;
  let avgHandSize = dist(keypoints[0].x, keypoints[0].y, keypoints[9].x, keypoints[9].y);
  let zOffset = map(avgHandSize, 50, 200, 20, 80); // Dynamically adjust based on hand size

  // Add zOffset to the buffer and maintain the buffer size
  zOffsetBuffers[i].push(zOffset);
  if (zOffsetBuffers[i].length > SMOOTHING_WINDOW_SIZE) {
    zOffsetBuffers[i].shift();
  }

  // Calculate the smoothed zOffset
  let smoothedZOffset = zOffsetBuffers[i].reduce((sum, val) => sum + val, 0) / zOffsetBuffers[i].length;

  // Measure distance between thumb and index finger
  let pinchDist = dist(keypoints[4].x, keypoints[4].y, keypoints[8].x, keypoints[8].y);

  // Add pinchDist to the buffer and maintain the buffer size
  pinchDistBuffers[i].push(pinchDist);
  if (pinchDistBuffers[i].length > SMOOTHING_WINDOW_SIZE) {
    pinchDistBuffers[i].shift();
  }

  // Calculate the smoothed pinchDist
  let smoothedPinchDist = pinchDistBuffers[i].reduce((sum, val) => sum + val, 0) / pinchDistBuffers[i].length;

  // Calculate the smoothed angle change
  let smoothedAngleChange = calculateHandRotation(hand, i);

  // Display smoothed zOffset, pinchDist, and angle change values
  fill(255);
  textSize(16);
  if (i === 0) { // Left hand
    text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)} | Angle: ${degrees(smoothedAngleChange).toFixed(2)}`, 10, 20);
  } else if (i === 1) { // Right hand
    text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)} | Angle: ${degrees(smoothedAngleChange).toFixed(2)}`, width - 300, 20);
  }

  // zOffset is acting as our threshold value to determine if a pinch has happened
  let pinchThreshold = smoothedZOffset / 2.0;
    // Draw a pink circle at the midpoint with size based on smoothedZOffset
    noFill();
    stroke(255, 105, 180); // Pink stroke
    strokeWeight(2); // Set stroke weight for visibility
    ellipse(midX, midY, pinchThreshold, pinchThreshold); 
    noStroke();

  if (smoothedPinchDist < pinchThreshold) {
    if (!pinchActive[i]) { // Only detect a new pinch if not already active
      // Determine which grid cell the midpoint is in
      let { row, col } = getGridCellIndex(midX, midY, squareX, squareY, gridSize);
      if (row >= 0 && row < 4 && col >= 0 && col < 4) {
        gridState[row][col] = !gridState[row][col]; // Toggle the cell highlight
      }

      // Set pinch as active
      pinchActive[i] = true;
    }
  } else {
    // Reset pinch state when pinch is released
    pinchActive[i] = false;
  }
}

function normalizeAngle(angle) {
  while (angle > PI) angle -= TWO_PI;
  while (angle < -PI) angle += TWO_PI;
  return angle;
}

function calculateHandRotation(hand, handIndex) {
  let wrist = hand.keypoints[0];
  let middleBase = hand.keypoints[9];

  // Calculate the angle of the hand
  let angle = atan2(middleBase.y - wrist.y, middleBase.x - wrist.x);

  // Initialize the initial angle if not set
  if (initialAngles[handIndex] === null) {
    initialAngles[handIndex] = angle;
  }

  // Calculate the change in angle
  let angleChange = angle - initialAngles[handIndex];

  // Normalize the angle change
  angleChange = normalizeAngle(angleChange);

  // Add angleChange to the buffer and maintain the buffer size
  angleBuffers[handIndex].push(angleChange);
  if (angleBuffers[handIndex].length > ANGLE_SMOOTHING_WINDOW_SIZE) {
    angleBuffers[handIndex].shift();
  }

  // Calculate the smoothed angle change
  let smoothedAngleChange = angleBuffers[handIndex].reduce((sum, val) => sum + val, 0) / angleBuffers[handIndex].length;

  return smoothedAngleChange;
}

