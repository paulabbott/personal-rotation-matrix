
/* ===
ml5 Example
Webcam Image Classification using a pre-trained customized model and p5.js
This example uses p5 preload function to create the classifier
=== */

// Classifier Variable
let classifier;
// Model URL
let imageModelURL = "https://teachablemachine.withgoogle.com/models/3fBgklrs1J/";


// Video
let video;
let flippedVideo;

// To store the classification
let label = "";

let myClass = "Nothing"; // this is the default "white wall class"

// Load the model first 
function preload() {
  console.log(imageModelURL + 'model.json');
  ml5.setBackend('webgl');
  classifier = ml5.imageClassifier(imageModelURL + 'model.json',modelLoaded);
}

function setup() {
  createCanvas(640, 480);

  // Create the webcam video and hide it
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();

  // Start detecting objects in the video
  classifier.classifyStart(video, gotResult);
}

function draw() {
  // Each video frame is painted on the canvas
  image(video, 0, 0);

  
  //Do our logic to create a program using image classification
  if(myClass === "Duck"){
    fill(255,255,0);
    circle(width/2,height/2,40);
  }else if(myClass === "Phone"){
    fill(0,255,0);
    circle(width/2,height/2,40);
  }else{
    text("Show me an object",width/2,height/2);
  }

  // Draw the label
  fill(255);
  textSize(16);
  textAlign(CENTER);
  text(label, width / 2, height - 4);

}

// A function to run when we get the results
function gotResult(results) {
  // The results are in an array ordered by confidence.
  // console.log(results[0]);

  let confidence = results[0].confidence;
  
  //we can ignore some of the less "confident" probabilities to make our program a little less noisy/inaccurate
  if(confidence > 0.7){
    label = results[0].label + ": " + confidence; //display class & confidence
    myClass = results[0].label;//update the class name
  }
    
}

function modelLoaded(){
  console.log("Loaded");
}
