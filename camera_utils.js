// Camera Logic
let currentStream = null;
let currentTargetInputId = null;

// Open Camera Modal
function openCamera(targetInputId, facingMode = 'environment') {
    currentTargetInputId = targetInputId;
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');

    modal.style.display = 'flex';

    // Constraints
    const constraints = {
        video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            currentStream = stream;
            video.srcObject = stream;
            video.play();
        })
        .catch(err => {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please allow camera permissions.");
            closeCamera();
        });
}

// Close Camera Modal
function closeCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-video');

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    video.srcObject = null;
    modal.style.display = 'none';
}

// Capture Photo
function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.createElement('canvas'); // Internal canvas

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Turn into Blob -> File
    canvas.toBlob(blob => {
        const file = new File([blob], "captured_image.png", { type: "image/png" });

        // Assign to the hidden input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const input = document.getElementById(currentTargetInputId);
        input.files = dataTransfer.files;

        // Show Preview
        showPreview(currentTargetInputId, canvas.toDataURL());

        closeCamera();
    }, 'image/png');
}

// Helper to show preview image
function showPreview(inputId, dataUrl) {
    const previewContainer = document.getElementById('preview-' + inputId);
    if (previewContainer) {
        previewContainer.innerHTML = `<img src="${dataUrl}" class="preview-thumb" alt="Preview">`;
        previewContainer.style.display = 'block';
    }
}
