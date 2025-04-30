// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded');
    const videoProcessor = new VideoProcessor(
        document.getElementById('video'),
        document.getElementById('overlayCanvas'),
        document.getElementById('canvas'),
        document.getElementById('shaderOverlayCanvas')
    );
}); 