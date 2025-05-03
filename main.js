// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const gridCanvas = document.getElementById('gridCanvas');
    const handCanvas = document.getElementById('handCanvas');
    const canvas = document.getElementById('canvas');
    const shaderOverlayCanvas = document.getElementById('shaderOverlayCanvas');
    const rightHandCanvas = document.getElementById('rightHandCanvas');

    const videoProcessor = new VideoProcessor(video, gridCanvas, handCanvas, canvas, shaderOverlayCanvas, rightHandCanvas);
}); 