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
let gridRotation = Array(4).fill().map(() => Array(4).fill(0)); // Track rotation state (0, 90, 180, 270 degrees)
let flashTimers = Array(4).fill().map(() => Array(4).fill(0)); // Track flash timing for each square
const FLASH_DURATION = 200; // Flash duration in milliseconds
let squareX, squareY, gridSize; // Declare as global variables
let pinchActive = [false, false]; // Array to track pinch state for each hand
let pinchDistBuffers = [[], []]; // Buffers for smoothing pinchDist values
let lastPinchTime = [0, 0]; // Array to track the last pinch time for each hand
const DEBOUNCE_TIME = 300; // Debounce time in milliseconds
let squareBuffers = Array(4).fill().map(() => Array(4).fill(null)); // Reusable graphics buffers for each square


function preload() {
  //can set number of hands to detect
  let options = {
    maxHands: 4,
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

  // Initialize graphics buffers
  let squareSize = height - 80;
  gridSize = squareSize / 4;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      squareBuffers[i][j] = createGraphics(gridSize, gridSize);
    }
  }
}

function draw() {
  // Draw the full video feed first
  image(video, 0, 0, width, height);

  // Calculate grid dimensions
  let squareSize = height - 80; // 40px away from top and bottom
  squareX = (width - squareSize) / 2;
  squareY = 40;
  gridSize = squareSize / 4;

  // Draw rotated portions for selected squares
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (gridState[i][j]) {
        let x = squareX + j * gridSize;
        let y = squareY + i * gridSize;
        
        // Use the existing buffer instead of creating a new one
        let buffer = squareBuffers[i][j];
        buffer.clear();
        buffer.image(video, 0, 0, gridSize, gridSize, x, y, gridSize, gridSize);
        
        // Draw the rotated square
        push();
        translate(x + gridSize/2, y + gridSize/2);
        rotate(radians(gridRotation[i][j]));
        image(buffer, -gridSize/2, -gridSize/2);
        pop();
      }
    }
  }

  // Draw grid overlay with flashing effect
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let alpha = 0;
      if (flashTimers[i][j] > 0) {
        // Calculate alpha based on time remaining
        alpha = map(flashTimers[i][j], FLASH_DURATION, 0, 200, 0);
        flashTimers[i][j] -= deltaTime;
      }
      fill(255, 255, 255, alpha);
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

  drawHandsLine();
}

function gotHands(results) {
  hands = results;
}

function getGridCellIndex(x, y, squareX, squareY, gridSize) {
  let col = Math.floor((x - squareX) / gridSize);
  let row = Math.floor((y - squareY) / gridSize);
  return { row, col };
}

function drawHandsLine() {
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    let keypoints = hand.keypoints;
    let indexF = keypoints[8]; // Index finger tip
    let thumb = keypoints[4]; // Thumb tip

    // Draw palm triangle using wrist (0), index finger base (5), and pinky base (17)
    let wrist = keypoints[0];
    let indexBase = keypoints[5];
    let pinkyBase = keypoints[17];

    // Draw the triangle
    stroke(255, 0, 0); // Red color for the triangle
    strokeWeight(2);
    noFill();
    triangle(
      wrist.x, wrist.y,
      indexBase.x, indexBase.y,
      pinkyBase.x, pinkyBase.y
    );

    // Draw a line between the thumb and index finger
    stroke(0, 0, 0);
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

    //measure distance between thumb and index finger
    let pinchDist = dist(thumb.x, thumb.y, indexF.x, indexF.y);

    // Add pinchDist to the buffer and maintain the buffer size
    pinchDistBuffers[i].push(pinchDist);
    if (pinchDistBuffers[i].length > SMOOTHING_WINDOW_SIZE) {
      pinchDistBuffers[i].shift();
    }

    // Calculate the smoothed pinchDist
    let smoothedPinchDist = pinchDistBuffers[i].reduce((sum, val) => sum + val, 0) / pinchDistBuffers[i].length;

    // Display smoothed zOffset and pinchDist values
    noStroke();    
    fill(255);
    textSize(16);
    if (i === 0) { // Left hand
      text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)}`, 10, 20);
    } else if (i === 1) { // Right hand
      text(`zOffset: ${Math.round(smoothedZOffset)} | pinchDist: ${Math.round(smoothedPinchDist)}`, width - 200, 20);
    }

    // zOffset is acting as our threshold value to determine if a pinch has happened
    let pinchThreshold = smoothedZOffset / 1.25;
    stroke(0, 0, 0);
    noFill();
    ellipse(midX, midY, pinchThreshold, pinchThreshold);
    noStroke();

    if (smoothedPinchDist < pinchThreshold) {
      let currentTime = millis();
      if (!pinchActive[i] && (currentTime - lastPinchTime[i] > DEBOUNCE_TIME)) {
        // Determine which grid cell the midpoint is in
        let { row, col } = getGridCellIndex(midX, midY, squareX, squareY, gridSize);
        if (row >= 0 && row < 4 && col >= 0 && col < 4) {
          gridState[row][col] = !gridState[row][col]; // Toggle the cell highlight
          if (gridState[row][col]) {
            // Increment rotation by 90 degrees when selected
            gridRotation[row][col] = (gridRotation[row][col] + 90) % 360;
            // Start the flash timer
            flashTimers[row][col] = FLASH_DURATION;
          }
        }

        // Set pinch as active
        pinchActive[i] = true;
        lastPinchTime[i] = currentTime;

        // Log the state arrays
        console.log('gridState:', gridState);
        console.log('pinchActive:', pinchActive);
      }
    } else {
      // Reset pinch state when pinch is released
      pinchActive[i] = false;
    }
  }
}

function drawKeypoints() {
  // loop through key points on each hand and draw a circle at each point
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(128, 128, 128);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }
}

// Note: For better performance with many rotations, consider implementing a WebGL shader version:
// 1. Create a shader program that handles the rotation
// 2. Pass the video texture and rotation angles to the shader
// 3. Use instanced rendering for the grid squares
// This would significantly reduce CPU usage and improve performance for complex scenes.

