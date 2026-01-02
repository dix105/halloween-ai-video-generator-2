document.addEventListener('DOMContentLoaded', () => {
    
    // =========================================
    // NAVIGATION & SCROLL (EXISTING UI)
    // =========================================
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });
        
        document.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // =========================================
    // HERO ANIMATION (EXISTING UI)
    // =========================================
    function createEmbers(count = 30) {
        const container = document.querySelector('.hero-bg-animation');
        if (!container) return;
        
        for (let i = 0; i < count; i++) {
            const ember = document.createElement('div');
            ember.className = 'ember';
            ember.style.left = Math.random() * 100 + '%';
            ember.style.animationDelay = Math.random() * 8 + 's';
            ember.style.animationDuration = (5 + Math.random() * 5) + 's';
            const size = 2 + Math.random() * 4;
            ember.style.width = size + 'px';
            ember.style.height = size + 'px';
            container.appendChild(ember);
        }
    }
    createEmbers(40);

    // =========================================
    // FAQ ACCORDION (EXISTING UI)
    // =========================================
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            faqItems.forEach(other => other.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });

    // =========================================
    // MODAL LOGIC (EXISTING UI)
    // =========================================
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    document.querySelectorAll('[data-modal-target]').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = trigger.getAttribute('data-modal-target');
            openModal(targetId);
        });
    });

    document.querySelectorAll('[data-modal-close]').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const targetId = closeBtn.getAttribute('data-modal-close');
            closeModal(targetId);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // =========================================
    // BACKEND API LOGIC (INJECTED)
    // =========================================

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Upload file to CDN storage (called immediately when file is selected)
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        // Filename is just nanoid.extension
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL from API
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        console.log('Got signed URL');
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = 'https://contents.maxstudio.ai/' + fileName;
        console.log('Uploaded to:', downloadUrl);
        return downloadUrl;
    }

    // Store the uploaded URL globally
    let currentUploadedUrl = null;

    // Submit generation job (Image or Video)
    async function submitImageGenJob(imageUrl) {
        // CONFIG: Video Effects
        const isVideo = 'video-effects' === 'video-effects';
        const endpoint = isVideo ? 'https://api.chromastudio.ai/video-gen' : 'https://api.chromastudio.ai/image-gen';
        
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0'
        };

        let body = {};
        if (isVideo) {
            body = {
                imageUrl: [imageUrl],
                effectId: 'halloween',
                userId: 'DObRu1vyStbUynoQmTcHBlhs55z2',
                removeWatermark: true,
                model: 'video-effects',
                isPrivate: true
            };
        } else {
            body = {
                model: 'video-effects',
                toolType: 'video-effects',
                effectId: 'halloween',
                imageUrl: imageUrl,
                userId: 'DObRu1vyStbUynoQmTcHBlhs55z2',
                removeWatermark: true,
                isPrivate: true
            };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        console.log('Job submitted:', data.jobId, 'Status:', data.status);
        return data;
    }

    // Poll job status until completed or failed
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const POLL_INTERVAL = 2000;
    const MAX_POLLS = 60;

    async function pollJobStatus(jobId) {
        const isVideo = 'video-effects' === 'video-effects';
        const baseUrl = isVideo ? 'https://api.chromastudio.ai/video-gen' : 'https://api.chromastudio.ai/image-gen';
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                console.log('Job completed!', data);
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out after ' + MAX_POLLS + ' polls');
    }

    // =========================================
    // UI HELPERS
    // =========================================

    function showLoading() {
        const loader = document.getElementById('loading-state');
        const resultContainer = document.getElementById('result-container');
        if (loader) loader.classList.remove('hidden'); // Use class based on existing CSS
        if (loader) loader.style.display = 'flex'; // Force display if class logic differs
        if (resultContainer) resultContainer.classList.add('loading');
        
        // Hide existing results
        const resultImage = document.getElementById('result-image');
        const resultVideo = document.getElementById('result-video');
        const resultPlaceholder = document.getElementById('result-placeholder');
        if (resultImage) resultImage.classList.add('hidden');
        if (resultVideo) resultVideo.classList.add('hidden');
        if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
    }

    function hideLoading() {
        const loader = document.getElementById('loading-state');
        const resultContainer = document.getElementById('result-container');
        if (loader) loader.classList.add('hidden');
        if (loader) loader.style.display = 'none';
        if (resultContainer) resultContainer.classList.remove('loading');
    }

    function updateStatus(text) {
        // Fix: Check for loading-text ID (from HTML) or fallback to status-text
        const statusText = document.getElementById('loading-text') || document.getElementById('status-text') || document.querySelector('.status-text');
        if (statusText) statusText.textContent = text;
        
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn && (text.includes('PROCESSING') || text.includes('UPLOADING') || text.includes('SUBMITTING'))) {
            generateBtn.disabled = true;
            generateBtn.textContent = text;
        } else if (generateBtn && text === 'READY') {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate';
        } else if (generateBtn && text === 'COMPLETE') {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Again';
        }
    }

    function showError(msg) {
        alert('Error: ' + msg); 
    }

    function showPreview(url) {
        const img = document.getElementById('preview-image');
        const placeholder = document.querySelector('.upload-placeholder');
        const uploadZone = document.getElementById('upload-zone');
        
        if (img) {
            img.src = url;
            img.classList.remove('hidden');
            img.style.display = 'block';
        }
        if (placeholder) placeholder.classList.add('hidden');
        if (uploadZone) uploadZone.style.borderStyle = 'solid';
    }

    function enableGenerateButton() {
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function showResultMedia(url) {
        const container = document.getElementById('result-container');
        if (!container) return;
        
        const isVideo = url.toLowerCase().match(/\.(mp4|webm)(\?.*)?$/i);
        const resultImage = document.getElementById('result-image');
        let resultVideo = document.getElementById('result-video');

        if (isVideo) {
            // Hide image
            if (resultImage) {
                resultImage.classList.add('hidden');
                resultImage.style.display = 'none';
            }
            
            // Show/Create video
            if (!resultVideo) {
                resultVideo = document.createElement('video');
                resultVideo.id = 'result-video';
                resultVideo.controls = true;
                resultVideo.autoplay = true;
                resultVideo.loop = true;
                resultVideo.className = 'w-full h-auto rounded-lg shadow-lg';
                container.appendChild(resultVideo);
            }
            resultVideo.src = url;
            resultVideo.classList.remove('hidden');
            resultVideo.style.display = 'block';
        } else {
            // Hide video
            if (resultVideo) {
                resultVideo.classList.add('hidden');
                resultVideo.style.display = 'none';
            }
            
            // Show image
            if (resultImage) {
                resultImage.classList.remove('hidden');
                resultImage.style.display = 'block';
                resultImage.src = url + '?t=' + new Date().getTime();
            }
        }
    }

    function showDownloadButton(url) {
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.dataset.url = url;
            downloadBtn.disabled = false;
            downloadBtn.style.display = 'inline-flex';
        }
    }

    // =========================================
    // EVENT HANDLERS
    // =========================================

    // Handler when file is selected - uploads immediately
    async function handleFileSelect(file) {
        try {
            // Basic validation
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }

            // UI Updates before upload
            const loader = document.getElementById('loading-state');
            if (loader) {
                const textEl = document.getElementById('loading-text') || loader.querySelector('p');
                if (textEl) textEl.textContent = 'Uploading...';
                loader.classList.remove('hidden');
                loader.style.display = 'flex';
            }
            updateStatus('UPLOADING...');
            
            // Upload immediately
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            // Show preview
            showPreview(uploadedUrl);
            
            updateStatus('READY');
            hideLoading();
            
            // Enable generation
            enableGenerateButton();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // Handler when Generate button is clicked
    async function handleGenerate() {
        if (!currentUploadedUrl) {
            alert('Please upload an image first');
            return;
        }
        
        try {
            showLoading();
            updateStatus('SUBMITTING JOB...');
            
            // Step 1: Submit
            const jobData = await submitImageGenJob(currentUploadedUrl);
            console.log('Job ID:', jobData.jobId);
            
            updateStatus('JOB QUEUED...');
            
            // Step 2: Poll
            const result = await pollJobStatus(jobData.jobId);
            
            // Step 3: Extract URL
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.video || resultItem?.image;
            
            if (!resultUrl) {
                console.error('Response:', result);
                throw new Error('No media URL in response');
            }
            
            console.log('Result URL:', resultUrl);
            
            // Update download URL
            showDownloadButton(resultUrl);
            
            // Step 4: Display
            showResultMedia(resultUrl);
            
            updateStatus('COMPLETE');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // Wire File Input
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary)';
            uploadZone.style.background = 'rgba(255, 107, 0, 0.1)';
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });
        
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Wire Generate Button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Wire Reset Button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentUploadedUrl = null;
            
            // Reset Preview Area
            const previewImage = document.getElementById('preview-image');
            const uploadPlaceholder = document.querySelector('.upload-placeholder');
            const fileInput = document.getElementById('file-input');
            
            if (previewImage) {
                previewImage.src = '';
                previewImage.classList.add('hidden');
            }
            if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
            if (uploadZone) uploadZone.style.borderStyle = 'dashed';
            if (fileInput) fileInput.value = '';
            
            // Reset Result Area
            const resultImage = document.getElementById('result-image');
            const resultVideo = document.getElementById('result-video');
            const resultPlaceholder = document.getElementById('result-placeholder');
            
            if (resultImage) resultImage.classList.add('hidden');
            if (resultVideo) resultVideo.classList.add('hidden');
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            
            // Reset Buttons
            const generateBtn = document.getElementById('generate-btn');
            const downloadBtn = document.getElementById('download-btn');
            
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Generate';
            }
            if (downloadBtn) {
                downloadBtn.disabled = true;
                downloadBtn.style.display = 'none'; // Or add 'hidden' class depending on CSS
            }
            
            hideLoading();
        });
    }

    // Wire Download Button (Robust Strategy)
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;
            
            function downloadBlob(blob, filename) {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }
            
            function getExtension(url, contentType) {
                if (contentType) {
                    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
                    if (contentType.includes('png')) return 'png';
                    if (contentType.includes('webp')) return 'webp';
                    if (contentType.includes('mp4')) return 'mp4';
                    if (contentType.includes('webm')) return 'webm';
                }
                const match = url.match(/\.(jpe?g|png|webp|mp4|webm)/i);
                return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
            }
            
            try {
                // STRATEGY 1: ChromaStudio Proxy
                const proxyUrl = 'https://api.chromastudio.ai/download-proxy?url=' + encodeURIComponent(url);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Proxy failed: ' + response.status);
                
                const blob = await response.blob();
                const ext = getExtension(url, response.headers.get('content-type'));
                downloadBlob(blob, 'result_' + generateNanoId(8) + '.' + ext);
                
            } catch (proxyErr) {
                console.warn('Proxy download failed, trying direct fetch:', proxyErr.message);
                
                // STRATEGY 2: Direct Fetch
                try {
                    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
                    const response = await fetch(fetchUrl, { mode: 'cors' });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        const ext = getExtension(url, response.headers.get('content-type'));
                        downloadBlob(blob, 'result_' + generateNanoId(8) + '.' + ext);
                        return;
                    }
                    throw new Error('Direct fetch failed: ' + response.status);
                } catch (fetchErr) {
                    console.warn('Direct fetch failed:', fetchErr.message);
                    alert('Download failed due to browser security restrictions. Please right-click the result and select "Save As".');
                }
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }

    // =========================================
    // SCROLL ANIMATIONS (EXISTING UI)
    // =========================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.step-card, .gallery-item, .faq-item').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(el);
    });
    
    document.addEventListener('scroll', () => {
        document.querySelectorAll('.visible').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    });
});