class PhotoEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.drawingCanvas = document.getElementById('drawingCanvas');
        this.drawingCtx = this.drawingCanvas.getContext('2d');
        this.originalImage = null;
        this.currentImage = null;
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0
        };
        this.currentFilter = 'none';
        this.rotation = 0;
        this.isCropping = false;
        this.cropStartX = 0;
        this.cropStartY = 0;
        this.cropEndX = 0;
        this.cropEndY = 0;
        
        // Drawing tools
        this.isDrawing = false;
        this.isDrawingMode = false;
        this.currentTool = 'pen';
        this.drawingColor = '#ff0000';
        this.brushSize = 5;
        this.lastX = 0;
        this.lastY = 0;
        this.drawingHistory = [];
        
        // Text tool
        this.isAddingText = false;
        this.textInput = null;
        
        // Shapes
        this.isDrawingShape = false;
        this.shapeType = 'rectangle';
        this.startShapeX = 0;
        this.startShapeY = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSliders();
        this.setupFilters();
        this.setupCrop();
        this.setupMarkupTools();
        this.setupSaveOptions();
    }

    setupEventListeners() {
        const uploadBtn = document.getElementById('uploadBtn');
        const saveBtn = document.getElementById('saveBtn');
        const resetBtn = document.getElementById('resetBtn');
        const fileInput = document.getElementById('fileInput');
        const uploadPlaceholder = document.getElementById('uploadPlaceholder');

        uploadBtn.addEventListener('click', () => fileInput.click());
        uploadPlaceholder.addEventListener('click', () => fileInput.click());
        saveBtn.addEventListener('click', () => this.saveImage());
        resetBtn.addEventListener('click', () => this.resetImage());
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadPlaceholder.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        uploadPlaceholder.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.loadImage(files[0]);
            }
        });
    }

    setupSliders() {
        const sliders = ['brightness', 'contrast', 'saturation', 'blur'];
        sliders.forEach(sliderName => {
            const slider = document.getElementById(sliderName);
            const valueDisplay = slider.nextElementSibling;
            
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.adjustments[sliderName] = value;
                valueDisplay.textContent = value;
                this.applyAdjustments();
            });
        });

        // Quality slider
        const qualitySlider = document.getElementById('qualitySlider');
        const qualityValue = qualitySlider.nextElementSibling;
        qualitySlider.addEventListener('input', (e) => {
            qualityValue.textContent = Math.round(e.target.value * 100) + '%';
        });
    }

    setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.applyAdjustments();
            });
        });
    }

    setupCrop() {
        const cropBtn = document.getElementById('cropBtn');
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');

        cropBtn.addEventListener('click', () => this.startCrop());
        rotateLeftBtn.addEventListener('click', () => this.rotateImage(-90));
        rotateRightBtn.addEventListener('click', () => this.rotateImage(90));
    }

    setupMarkupTools() {
        const drawBtn = document.getElementById('drawBtn');
        const textBtn = document.getElementById('textBtn');
        const shapeBtn = document.getElementById('shapeBtn');
        const eraserBtn = document.getElementById('eraserBtn');
        const drawingColor = document.getElementById('drawingColor');
        const brushSize = document.getElementById('brushSize');

        drawBtn.addEventListener('click', () => this.setDrawingTool('pen'));
        textBtn.addEventListener('click', () => this.setDrawingTool('text'));
        shapeBtn.addEventListener('click', () => this.setDrawingTool('shape'));
        eraserBtn.addEventListener('click', () => this.setDrawingTool('eraser'));
        
        drawingColor.addEventListener('change', (e) => {
            this.drawingColor = e.target.value;
        });
        
        brushSize.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            e.target.nextElementSibling.textContent = e.target.value;
        });

        // Drawing events
        this.drawingCanvas.style.pointerEvents = 'auto'; // Enable pointer events for drawing canvas
        this.drawingCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.drawingCanvas.addEventListener('mousemove', (e) => this.draw(e));
        this.drawingCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.drawingCanvas.addEventListener('mouseout', () => this.stopDrawing());
    }

    draw(e) {
        if (!this.isDrawing || !this.isDrawingMode) return;

        const rect = this.drawingCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);

        if (this.currentTool === 'pen') {
            this.drawingCtx.globalCompositeOperation = 'source-over';
            this.drawingCtx.strokeStyle = this.drawingColor;
            this.drawingCtx.lineJoin = 'round';
            this.drawingCtx.lineCap = 'round';
            this.drawingCtx.lineWidth = this.brushSize;
            this.drawingCtx.beginPath();
            this.drawingCtx.moveTo(this.lastX, this.lastY);
            this.drawingCtx.lineTo(currentX, currentY);
            this.drawingCtx.stroke();
        } else if (this.currentTool === 'eraser') {
            this.drawingCtx.globalCompositeOperation = 'destination-out';
            this.drawingCtx.beginPath();
            this.drawingCtx.arc(currentX, currentY, this.brushSize / 2, 0, Math.PI * 2);
            this.drawingCtx.fill();
            this.drawingCtx.globalCompositeOperation = 'source-over';
        } else if (this.currentTool === 'shape') {
            this.drawingCtx.globalCompositeOperation = 'source-over';
            this.drawingCtx.strokeStyle = this.drawingColor;
            this.drawingCtx.lineWidth = this.brushSize;
            this.drawingCtx.beginPath();
            const width = currentX - this.startShapeX;
            const height = currentY - this.startShapeY;
            this.drawingCtx.rect(this.startShapeX, this.startShapeY, width, height);
            this.drawingCtx.stroke();
        }

        this.lastX = currentX;
        this.lastY = currentY;
    }

    stopDrawing() {
        if (this.currentTool === 'shape' && this.isDrawingShape) {
            // Commit shape drawing to main drawing canvas
            this.drawingCtx.globalCompositeOperation = 'source-over';
            this.drawingCtx.stroke();
            this.commitDrawing();
        }
        this.isDrawing = false;
        this.isDrawingShape = false;
    }

    commitDrawing() {
        // Draw the temporary drawing canvas content onto the main drawing canvas permanently
        this.drawingCtx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(this.drawingCanvas, 0, 0);
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
    }

    setupSaveOptions() {
        const formatSelect = document.getElementById('formatSelect');
        formatSelect.addEventListener('change', (e) => {
            this.currentFormat = e.target.value;
        });
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (file) {
            this.loadImage(file);
        }
    }

    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.currentImage = img;
                this.displayImage(img);
                this.enableControls();
                document.getElementById('uploadPlaceholder').style.display = 'none';
                this.setupDrawingCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage(img) {
        const maxWidth = window.innerWidth - 350;
        const maxHeight = window.innerHeight - 100;
        
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        
        width *= ratio;
        height *= ratio;

        this.canvas.width = width;
        this.canvas.height = height;
        this.setupDrawingCanvas();
        
        this.drawImage();
    }

    setupDrawingCanvas() {
        this.drawingCanvas.width = this.canvas.width;
        this.drawingCanvas.height = this.canvas.height;
        this.drawingCanvas.style.pointerEvents = this.isDrawingMode ? 'auto' : 'none';
    }

    drawImage() {
        if (!this.currentImage) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context state
        this.ctx.save();
        
        // Apply rotation
        if (this.rotation !== 0) {
            this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.rotate((this.rotation * Math.PI) / 180);
            this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        }
        
        // Apply filters and adjustments
        const filterString = this.buildFilterString();
        this.ctx.filter = filterString;
        
        // Draw image
        this.ctx.drawImage(this.currentImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Restore context state
        this.ctx.restore();
    }

    buildFilterString() {
        const filters = [];
        
        if (this.adjustments.brightness !== 0) {
            filters.push(`brightness(${1 + this.adjustments.brightness / 100})`);
        }
        
        if (this.adjustments.contrast !== 0) {
            filters.push(`contrast(${1 + this.adjustments.contrast / 100})`);
        }
        
        if (this.adjustments.saturation !== 0) {
            filters.push(`saturate(${1 + this.adjustments.saturation / 100})`);
        }
        
        if (this.adjustments.blur > 0) {
            filters.push(`blur(${this.adjustments.blur}px)`);
        }
        
        switch (this.currentFilter) {
            case 'grayscale':
                filters.push('grayscale(1)');
                break;
            case 'sepia':
                filters.push('sepia(1)');
                break;
            case 'invert':
                filters.push('invert(1)');
                break;
            case 'hue-rotate':
                filters.push('hue-rotate(180deg)');
                break;
            case 'vintage':
                filters.push('sepia(0.5) contrast(1.2) brightness(0.9)');
                break;
        }
        
        return filters.join(' ') || 'none';
    }

    applyAdjustments() {
        if (this.currentImage) {
            this.drawImage();
        }
    }

    setDrawingTool(tool) {
        // Reset all tool buttons
        document.querySelectorAll('.markup-tools .tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Activate selected tool
        document.getElementById(`${tool}Btn`).classList.add('active');
        
        this.currentTool = tool;
        this.isDrawingMode = true;
        this.drawingCanvas.style.pointerEvents = 'auto';
        
        // Show/hide drawing options
        const drawingOptions = document.getElementById('drawingOptions');
        drawingOptions.style.display = tool !== 'text' ? 'block' : 'none';
    }

    startDrawing(e) {
        if (!this.isDrawingMode) return;
        
        const rect = this.drawingCanvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
        
        if (this.currentTool === 'text') {
            this.addTextInput(this.lastX, this.lastY);
            this.isDrawingMode = false; // Disable drawing mode after adding text input
            return;
        }
        
        if (this.currentTool === 'shape') {
            this.isDrawingShape = true;
            this.startShapeX = this.lastX;
            this.startShapeY = this.lastY;
            return;
        }
        
        this.isDrawing = true;
    }

    draw(e) {
        if (!this.isDrawing || !this.isDrawingMode) return;
        
        const rect = this.drawingCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        this.drawingCtx.lineJoin = 'round';
        this.drawingCtx.lineCap = 'round';
        this.drawingCtx.lineWidth = this.brushSize;
        
        if (this.currentTool === 'pen') {
            this.drawingCtx.globalCompositeOperation = 'source-over';
            this.drawingCtx.strokeStyle = this.drawingColor;
            this.drawingCtx.beginPath();
            this.drawingCtx.moveTo(this.lastX, this.lastY);
            this.drawingCtx.lineTo(currentX, currentY);
            this.drawingCtx.stroke();
        } else if (this.currentTool === 'eraser') {
            this.drawingCtx.globalCompositeOperation = 'destination-out';
            this.drawingCtx.beginPath();
            this.drawingCtx.arc(currentX, currentY, this.brushSize / 2, 0, Math.PI * 2);
            this.drawingCtx.fill();
            this.drawingCtx.globalCompositeOperation = 'source-over';
        }
        
        this.lastX = currentX;
        this.lastY = currentY;
    }

    stopDrawing() {
        this.isDrawing = false;
        this.isDrawingShape = false;
    }

    addTextInput(x, y) {
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.style.position = 'absolute';
        textInput.style.left = x + 'px';
        textInput.style.top = y + 'px';
        textInput.style.zIndex = '1000';
        textInput.style.background = 'rgba(255,255,255,0.9)';
        textInput.style.border = '1px solid #3b82f6';
        textInput.style.padding = '5px';
        
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.drawingCtx.font = `${this.brushSize * 3}px Arial`;
                this.drawingCtx.fillStyle = this.drawingColor;
                this.drawingCtx.fillText(textInput.value, x, y);
                textInput.remove();
            }
        });
        
        textInput.addEventListener('blur', () => {
            textInput.remove();
        });
        
        document.body.appendChild(textInput);
        textInput.focus();
    }

    startCrop() {
        if (!this.currentImage) return;
        
        this.isCropping = true;
        const cropOverlay = document.getElementById('cropOverlay');
        const cropBox = document.getElementById('cropBox');
        
        cropOverlay.style.display = 'block';
        
        // Set initial crop box size
        cropBox.style.width = '200px';
        cropBox.style.height = '200px';
        cropBox.style.left = '50%';
        cropBox.style.top = '50%';
        cropBox.style.transform = 'translate(-50%, -50%)';
        
        this.setupCropEvents(cropBox, cropOverlay);
    }

    setupCropEvents(cropBox, cropOverlay) {
        let isDragging = false;
        let isResizing = false;
        let startX, startY, startWidth, startHeight, startLeft, startTop;

        cropBox.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('crop-handle')) {
                isResizing = true;
            } else {
                isDragging = true;
            }
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(cropBox.style.width);
            startHeight = parseInt(cropBox.style.height);
            startLeft = parseInt(cropBox.style.left) || 0;
            startTop = parseInt(cropBox.style.top) || 0;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                cropBox.style.left = (startLeft + dx) + 'px';
                cropBox.style.top = (startTop + dy) + 'px';
            } else if (isResizing) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                cropBox.style.width = (startWidth + dx) + 'px';
                cropBox.style.height = (startHeight + dy) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging || isResizing) {
                isDragging = false;
                isResizing = false;
                this.performCrop(cropBox);
            }
        });

        cropOverlay.addEventListener('click', (e) => {
            if (e.target === cropOverlay) {
                cropOverlay.style.display = 'none';
                this.isCropping = false;
            }
        });
    }

    performCrop(cropBox) {
        const rect = cropBox.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const scaleX = this.canvas.width / canvasRect.width;
        const scaleY = this.canvas.height / canvasRect.height;
        
        const cropX = (rect.left - canvasRect.left) * scaleX;
        const cropY = (rect.top - canvasRect.top) * scaleY;
        const cropWidth = rect.width * scaleX;
        const cropHeight = rect.height * scaleY;
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        
        tempCtx.drawImage(
            this.canvas,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
        );
        
        const croppedImg = new Image();
        croppedImg.onload = () => {
            this.currentImage = croppedImg;
            this.displayImage(croppedImg);
            document.getElementById('cropOverlay').style.display = 'none';
            this.isCropping = false;
            this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
            this.setupDrawingCanvas();
        };
        croppedImg.src = tempCanvas.toDataURL();
    }

    rotateImage(degrees) {
        if (!this.currentImage) return;
        
        this.rotation += degrees;
        if (this.rotation >= 360) this.rotation = 0;
        if (this.rotation < 0) this.rotation = 270;
        
        this.drawImage();
    }

    resetImage() {
        if (!this.originalImage) return;
        
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            blur: 0
        };
        this.currentFilter = 'none';
        this.rotation = 0;
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        
        // Reset sliders
        Object.keys(this.adjustments).forEach(key => {
            const slider = document.getElementById(key);
            slider.value = 0;
            slider.nextElementSibling.textContent = '0';
        });
        
        // Reset filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-filter="none"]').classList.add('active');
        
        this.currentImage = this.originalImage;
        this.displayImage(this.originalImage);
    }

    saveImage() {
        if (!this.currentImage) return;
        
        const format = document.getElementById('formatSelect').value;
        const quality = parseFloat(document.getElementById('qualitySlider').value);
        
        // Create a temporary canvas to combine both layers
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        
        // Draw the main image
        tempCtx.drawImage(this.canvas, 0, 0);
        
        // Draw the drawing layer on top
        tempCtx.drawImage(this.drawingCanvas, 0, 0);
        
        // Determine MIME type based on format
        let mimeType;
        switch (format) {
            case 'jpeg':
                mimeType = 'image/jpeg';
                break;
            case 'webp':
                mimeType = 'image/webp';
                break;
            case 'bmp':
                mimeType = 'image/bmp';
                break;
            default:
                mimeType = 'image/png';
        }
        
        const link = document.createElement('a');
        link.download = `edited-photo.${format}`;
        link.href = tempCanvas.toDataURL(mimeType, quality);
        link.click();
    }

    enableControls() {
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('resetBtn').disabled = false;
    }
}

// Initialize the photo editor
document.addEventListener('DOMContentLoaded', () => {
    new PhotoEditor();
});
