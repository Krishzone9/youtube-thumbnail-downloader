document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const getBtn = document.getElementById('getBtn');
    const resultSection = document.getElementById('resultSection');
    
    // Video elements
    const videoOutput = document.getElementById('videoOutput');
    const thumbnailImg = document.getElementById('thumbnailImg');
    const qualityBadge = document.getElementById('qualityBadge');
    const downloadBtn = document.getElementById('downloadBtn');
    const videoDetailsSection = document.getElementById('videoDetails');
    const videoTitleInput = document.getElementById('videoTitle');
    const videoDescTextarea = document.getElementById('videoDesc');
    const copyTitleBtn = document.getElementById('copyTitleBtn');
    const copyDescBtn = document.getElementById('copyDescBtn');

    // Channel elements
    const channelOutput = document.getElementById('channelOutput');
    const channelLogoImg = document.getElementById('channelLogoImg');
    const downloadLogoBtn = document.getElementById('downloadLogoBtn');
    const channelBannerImg = document.getElementById('channelBannerImg');
    const downloadBannerBtn = document.getElementById('downloadBannerBtn');
    
    // Channel Details
    const channelDetailsSection = document.getElementById('channelDetails');
    const channelTitleInput = document.getElementById('channelTitle');
    const channelDescTextarea = document.getElementById('channelDesc');
    const copyChannelTitleBtn = document.getElementById('copyChannelTitleBtn');
    const copyChannelDescBtn = document.getElementById('copyChannelDescBtn');

    const errorMessage = document.getElementById('errorMessage');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const pasteBtn = document.getElementById('pasteBtn');

    // Menu toggle logic
    const menuToggle = document.getElementById('menuToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (menuToggle && dropdownMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                dropdownMenu.classList.remove('active');
            }
        });
    }

    // FAQ Accordion Logic
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                
                faqItems.forEach(otherItem => {
                    otherItem.classList.remove('active');
                });

                if (!isActive) {
                    item.classList.add('active');
                }
            });
        }
    });

    if (!urlInput || !getBtn) return; 


    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                urlInput.value = text;
            } catch (err) {
                console.error('Failed to read clipboard contents: ', err);
                alert('Please allow clipboard permissions or paste manually.');
            }
        });
    }

    // Setup Copy functionality
    const setupCopy = (btn, input) => {
        if (!btn || !input) return;
        btn.addEventListener('click', () => {
            input.select();
            input.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(input.value);
            
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check" style="color: #4CAF50;"></i>';
            setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
        });
    };

    setupCopy(copyTitleBtn, videoTitleInput);
    setupCopy(copyDescBtn, videoDescTextarea);
    setupCopy(copyChannelTitleBtn, channelTitleInput);
    setupCopy(copyChannelDescBtn, channelDescTextarea);

    function determineLinkType(url) {
        url = url.toLowerCase();
        if (url.includes('/channel/') || url.includes('/c/') || url.includes('/user/') || url.includes('@')) {
            return 'channel';
        } else if (url.includes('watch?v=') || url.includes('youtu.be/') || url.includes('/shorts/')) {
            return 'video';
        }
        return 'unknown';
    }

    function extractVideoID(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?/\s]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    async function getChannelImagesFast(url) {
        const response = await fetch(`/api/channel?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error("Failed to fetch channel data");
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        return data;
    }

    async function handleAction() {
        const url = urlInput.value.trim();
        if (!url) return;

        errorMessage.style.display = 'none';
        resultSection.classList.remove('active');
        
        if (videoOutput) videoOutput.style.display = 'none';
        if (channelOutput) channelOutput.style.display = 'none';
        
        if (thumbnailImg) {
            thumbnailImg.className = ""; 
            thumbnailImg.onload = null;
            thumbnailImg.onerror = null;
        }

        loadingIndicator.style.display = 'block';
        getBtn.disabled = true;

        try {
            const linkType = determineLinkType(url);
            
            if (linkType === 'channel') {
                const { profileUrl, bannerUrl, channelName, channelDescription } = await getChannelImagesFast(url);
                
                if (profileUrl) {
                    channelLogoImg.src = `/api/proxy-image?url=${encodeURIComponent(profileUrl)}`;
                    downloadLogoBtn.href = `/api/download?url=${encodeURIComponent(profileUrl)}&filename=${encodeURIComponent('channel_logo.jpg')}`;
                    downloadLogoBtn.style.display = 'inline-flex';
                } else {
                    channelLogoImg.src = '';
                    downloadLogoBtn.style.display = 'none';
                }

                if (bannerUrl) {
                    channelBannerImg.src = `/api/proxy-image?url=${encodeURIComponent(bannerUrl)}`;
                    downloadBannerBtn.href = `/api/download?url=${encodeURIComponent(bannerUrl)}&filename=${encodeURIComponent('channel_banner.jpg')}`;
                    downloadBannerBtn.style.display = 'inline-flex';
                    channelBannerImg.parentElement.style.display = 'flex';
                } else {
                    channelBannerImg.src = '';
                    downloadBannerBtn.style.display = 'none';
                    channelBannerImg.parentElement.style.display = 'none';
                }

                if (channelDetailsSection) {
                    if (channelName || channelDescription) {
                        channelTitleInput.value = channelName || '';
                        channelDescTextarea.value = channelDescription || '';
                        channelDetailsSection.style.display = 'flex';
                    } else {
                        channelDetailsSection.style.display = 'none';
                    }
                }

                loadingIndicator.style.display = 'none';
                resultSection.classList.add('active');
                if (channelOutput) channelOutput.style.display = 'flex';

            } else if (linkType === 'video') {
                const videoId = extractVideoID(url);
                if (!videoId) {
                    throw new Error('Invalid YouTube URL');
                }
                
                let finalUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
                let filename = `yt_thumbnail_${videoId}.jpg`;
                qualityBadge.textContent = 'MAX RES (1280x720)';
                
                const applyFallback = () => {
                    const fallbackUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                    thumbnailImg.src = `/api/proxy-image?url=${encodeURIComponent(fallbackUrl)}`;
                    qualityBadge.textContent = 'HQ (480x360)';
                    downloadBtn.href = `/api/download?url=${encodeURIComponent(fallbackUrl)}&filename=${encodeURIComponent(filename)}`;
                };

                thumbnailImg.onload = () => {
                    if (thumbnailImg.naturalWidth === 120) {
                        applyFallback();
                    }
                };
                
                thumbnailImg.onerror = applyFallback;

                thumbnailImg.src = `/api/proxy-image?url=${encodeURIComponent(finalUrl)}`;
                downloadBtn.href = `/api/download?url=${encodeURIComponent(finalUrl)}&filename=${encodeURIComponent(filename)}`;
                
                loadingIndicator.style.display = 'none';
                resultSection.classList.add('active');
                if (videoOutput) videoOutput.style.display = 'flex';

                if (videoDetailsSection) {
                    videoDetailsSection.style.display = 'none';
                    fetch(`/api/video-info?url=${encodeURIComponent(url)}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.title || data.description) {
                                videoTitleInput.value = data.title || '';
                                videoDescTextarea.value = data.description || '';
                                videoDetailsSection.style.display = 'flex';
                            }
                        })
                        .catch(err => console.error("Error fetching video info:", err));
                }
            } else {
                throw new Error('Invalid YouTube URL');
            }

        } catch (e) {
            loadingIndicator.style.display = 'none';
            errorMessage.textContent = e.message === 'Invalid YouTube URL' 
                ? 'Invalid YouTube URL. Please try again.' 
                : 'Error processing URL. Make sure it is correct.';
            errorMessage.style.display = 'block';
        } finally {
            getBtn.disabled = false;
        }
    }

    getBtn.addEventListener('click', handleAction);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAction();
    });
});
