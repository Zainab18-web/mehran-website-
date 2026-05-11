let currentCurrency = 'PKR';
let currencySymbol = 'Rs ';
let exchangeRate = 1; // PKR baseline is 1.0 now!

let cart = JSON.parse(localStorage.getItem('cart')) || {}; // Store product id -> quantity
let websiteReviews = JSON.parse(localStorage.getItem('websiteReviews')) || [];
let productReviews = JSON.parse(localStorage.getItem('productReviews')) || {};

// --- Firebase Realtime Sync Event Handlers ---
window.updateWebsiteReviewsFromFirebase = (firebaseReviewsList) => {
    websiteReviews = firebaseReviewsList.reverse();
    const grid = document.getElementById('reviews-grid');
    if (grid) renderWebsiteReviews();
};

window.updateProductReviewsFromFirebase = (firebaseProductReviews) => {
    productReviews = {};
    for (let id in firebaseProductReviews) {
        productReviews[id] = Object.values(firebaseProductReviews[id]).reverse();
    }
    // Quick re-attach review HTML for open products without full re-render
    Object.keys(productReviews).forEach(id => {
        const list = document.getElementById(`prl-${id}`);
        if(list) {
            list.innerHTML = productReviews[id].map(r => `<div class="pr-item"><i>"${r.text}"</i><br><small>- ${r.name} ${r.stars}</small></div>`).join('');
        }
    });
};
// ---------------------------------------------


// Elements
const productsGrid = document.getElementById('products-grid');
const languageSelector = document.getElementById('language-selector');
const cartCountEl = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const cartBtn = document.getElementById('cart-btn');
const closeCartBtn = document.getElementById('close-cart');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalPriceEl = document.getElementById('cart-total-price');
const notificationContainer = document.getElementById('notification-container');
const checkoutForm = document.getElementById('checkout-form');
const orderSuccessView = document.getElementById('order-success');
const closeSuccessBtn = document.getElementById('close-success');
const deliveryAreaSelect = document.getElementById('delivery-area');
const checkoutSubtotalEl = document.getElementById('checkout-subtotal');
const deliveryCostEl = document.getElementById('delivery-cost');
const checkoutTotalEl = document.getElementById('checkout-total');

// Image Modal Elements
const imageModal = document.getElementById('image-modal');
const modalFullImage = document.getElementById('modal-full-image');
const modalProductName = document.getElementById('modal-product-name');
const closeImageModalBtn = document.getElementById('close-image-modal');

// Navigation Elements
const navBtns = document.querySelectorAll('.nav-btn');
const pageViews = document.querySelectorAll('.page-view');

// SPA Navigation Logic
navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const clickedBtn = e.currentTarget; 
        
        navBtns.forEach(b => b.classList.remove('active'));
        clickedBtn.classList.add('active');
        
        pageViews.forEach(view => view.classList.add('hidden'));
        
        const targetId = clickedBtn.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        targetView.classList.remove('hidden');
        
        // Auto-scroll to top on page change
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// Sticky Header Logic
window.addEventListener('scroll', () => {
    const header = document.querySelector('.glass-header');
    if (window.scrollY > 50) {
        header.style.padding = '0.8rem 3rem';
        header.style.background = 'rgba(15, 23, 42, 0.9)';
        header.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    } else {
        header.style.padding = '1rem 3rem';
        header.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))';
        header.style.boxShadow = 'none';
    }
});

// Logic to trigger real-time entire website Text & Currency translation
function translatePageContent(langCode) {
    let gtCode = langCode;
    // Map custom/complex codes to real google translate code if needed
    if (langCode === 'ru') gtCode = 'en'; // native GT doesn't have roman urdu, defaults to pure en text (but currency is PKR)
    if (langCode === 'ru-RU') gtCode = 'ru'; 

    const gtSelect = document.querySelector('.goog-te-combo');
    if (gtSelect) {
        gtSelect.value = gtCode;
        gtSelect.dispatchEvent(new Event('change'));
    }
}

// Initialize Languages
function initLanguages() {
    languagesList.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        languageSelector.appendChild(option);
    });
    
    // Set default value to Roman Urdu ('ru') which uses PKR
    languageSelector.value = 'ru';
    languageSelector.addEventListener('change', (e) => {
        const langObj = languagesList.find(l => l.code === e.target.value);
        if (langObj) {
            currentCurrency = langObj.currency;
            
            // Dynamic resolution from global registry maps for 100+ native country currencies
            // Resolve rate relative to PKR baseline
            // (Current Rate / PKR Rate) * Base Price in PKR = Final Price in Local Currency
            const basePKRRate = exchangeRates['PKR'] || 278.5;
            exchangeRate = (exchangeRates[currentCurrency] || 1) / basePKRRate; 

            currencySymbol = currencySymbols[currentCurrency] || (currentCurrency + ' '); // e.g. "AFN " if not stored explicitly

            // Only update prices to avoid wiping DOM nodes and killing translation!
            products.forEach(p => {
                const el = document.getElementById(`curr-price-${p.id}`);
                if (el) el.innerText = formatPrice(p.basePrice);
            });
            updateCartDisplay();
            if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary(); 

            // Trigger Google Translate after short delay
            setTimeout(() => {
                translatePageContent(e.target.value);
            }, 100);
        }
    });

    // Trigger initial language logic
    languageSelector.dispatchEvent(new Event('change'));
}

function formatPrice(price) {
    return `${currencySymbol}${(price * exchangeRate).toFixed(2)}`;
}

function showNotification(message, icon = '🛒') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<div style="font-size: 1.5rem;">${icon}</div> <div style="font-weight: 800;">${message}</div>`;
    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3500);
}

// Render Products
function renderProducts(filteredProducts = products) {
    productsGrid.innerHTML = '';
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = `<div class="no-results holo-text">No products found matching your criteria.</div>`;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card glass-panel';
        
        const qty = 1;
        
        card.innerHTML = `
            <div class="image-frame">
                ${product.imagePlaceholder}
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="price" id="curr-price-${product.id}">${formatPrice(product.basePrice)}</div>
            </div>
            <div class="product-actions">
                <div class="qty-controls">
                    <button class="qty-btn minus" data-id="${product.id}">-</button>
                    <span class="qty-display" id="qty-${product.id}">${qty}</span>
                    <button class="qty-btn plus" data-id="${product.id}">+</button>
                </div>
                <button class="add-to-cart" data-id="${product.id}">Add to Cart</button>
            </div>
            <div class="product-review-module">
                <button class="toggle-review-btn" data-id="${product.id}">⭐ Write a Review</button>
                <div class="pr-list" id="prl-${product.id}">
                    ${(productReviews[product.id] || [{text: "Good quality!", name: "Guest", stars: "⭐⭐⭐⭐⭐"}]).map(r => `<div class="pr-item"><i>"${r.text}"</i><br><small>- ${r.name} ${r.stars}</small></div>`).join('')}
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
    
    attachProductEvents();
}

// Search & Filter Logic
const searchInput = document.getElementById('product-search');
const filterBtns = document.querySelectorAll('.filter-btn');

function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase();
    const activeCategory = document.querySelector('.filter-btn.active').getAttribute('data-category');

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
}

if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
}

filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        
        // Visual feedback
        target.style.transform = 'scale(0.95)';
        setTimeout(() => target.style.transform = 'scale(1)', 100);
        
        filterProducts();
    });
});

function attachProductEvents() {
    document.querySelectorAll('.qty-btn.plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const display = document.getElementById(`qty-${id}`);
            let val = parseInt(display.innerText);
            display.innerText = val + 1;
        });
    });
    document.querySelectorAll('.qty-btn.minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const display = document.getElementById(`qty-${id}`);
            let val = parseInt(display.innerText);
            if (val > 1) {
                display.innerText = val - 1;
            }
        });
    });
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const qtyToAdd = parseInt(document.getElementById(`qty-${id}`).innerText);
            if (cart[id]) {
                cart[id] += qtyToAdd;
            } else {
                cart[id] = qtyToAdd;
            }
            // Reset UI qty back to 1
            document.getElementById(`qty-${id}`).innerText = 1;
            updateCartCount();
            
            const product = products.find(p => p.id == id);
            showNotification(`${product.name} added to cart!`);
        });
    });

    // Image Click - Open Modal
    document.querySelectorAll('.image-frame img').forEach(img => {
        img.addEventListener('click', (e) => {
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                const productName = productCard.querySelector('h3').innerText;
                const imgSrc = e.target.getAttribute('src');
                
                // Track for AI context
                lastMatchedProduct = products.find(p => p.name === productName);
                document.querySelector('.ai-notification-badge').style.display = 'block';

                modalFullImage.src = imgSrc;
                modalProductName.innerText = productName;
                imageModal.classList.remove('hidden');
            }
        });
    });

    // Product Reviews Open Modal
    document.querySelectorAll('.toggle-review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const product = products.find(p => p.id == id);
            
            // Set modal info
            document.getElementById('pr-modal-product-name').innerText = product.name;
            document.getElementById('pr-modal-product-id').value = id;
            
            // Show modal
            document.getElementById('product-review-modal').classList.remove('hidden');
        });
    });
}

function updateCartCount() {
    let count = 0;
    for(let id in cart) {
        count += cart[id];
    }
    cartCountEl.innerText = count;
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Modals Logic
cartBtn.addEventListener('click', () => {
    cartModal.classList.remove('hidden');
    updateCartDisplay();
});
closeCartBtn.addEventListener('click', () => cartModal.classList.add('hidden'));

// Image Modal Close
closeImageModalBtn.addEventListener('click', () => imageModal.classList.add('hidden'));
imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) imageModal.classList.add('hidden');
});

// Product Review Modal Close & Submit
const prModal = document.getElementById('product-review-modal');
const closePrModalBtn = document.getElementById('close-pr-modal');
const prModalForm = document.getElementById('pr-modal-form');

closePrModalBtn.addEventListener('click', () => prModal.classList.add('hidden'));
prModal.addEventListener('click', (e) => {
    if (e.target === prModal) prModal.classList.add('hidden');
});

prModalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('pr-modal-product-id').value;
    const nameStr = document.getElementById('pr-modal-name').value;
    const ratingStr = document.getElementById('pr-modal-rating').value;
    const textStr = document.getElementById('pr-modal-text').value;

    const list = document.getElementById(`prl-${id}`);
    if(list) {
        const starStr = '⭐'.repeat(parseInt(ratingStr));
        const reviewObj = { text: textStr, name: nameStr, stars: starStr };
        
        if (window.isFirebaseActive && window.isFirebaseActive()) {
            window.saveProductReviewToFirebase(id, reviewObj);
            // DOM updates automatically via updateProductReviewsFromFirebase
        } else {
            if (!productReviews[id]) productReviews[id] = [];
            productReviews[id].unshift(reviewObj);
            localStorage.setItem('productReviews', JSON.stringify(productReviews));

            const newItem = document.createElement('div');
            newItem.className = 'pr-item';
            newItem.innerHTML = `<i>"${textStr}"</i><br><small>- ${nameStr} ${starStr}</small>`;
            list.insertBefore(newItem, list.firstChild);
        }
    }

    prModalForm.reset();
    prModal.classList.add('hidden');
    showNotification("Thanks for your review! Aapka response bohat eham hai. 💖", "🌟");
});

function renderWebsiteReviews() {
    const grid = document.getElementById('reviews-grid');
    if (!grid) return;
    grid.innerHTML = '';
    websiteReviews.forEach(r => {
        const reviewCard = document.createElement('div');
        reviewCard.className = 'glass-panel';
        reviewCard.style.padding = '1.5rem';
        reviewCard.style.borderRadius = '16px';
        reviewCard.style.marginBottom = '1rem';
        reviewCard.innerHTML = `<h4>${r.name} <span style="font-size:0.8em; font-weight:normal">${r.stars}</span></h4><p style="margin-top:0.5rem;color:#cbd5e1;">"${r.text}"</p>`;
        grid.appendChild(reviewCard);
    });
}

// Website Review Form Submit
const websiteReviewForm = document.getElementById('review-form');
if (websiteReviewForm) {
    websiteReviewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const reviewName = document.getElementById('review-name').value;
        const reviewRating = document.getElementById('review-rating').value;
        const reviewText = document.getElementById('review-text').value;

        const stars = '⭐'.repeat(parseInt(reviewRating));
        const reviewObj = { name: reviewName, stars: stars, text: reviewText };
        
        if (window.isFirebaseActive && window.isFirebaseActive()) {
            window.saveWebsiteReviewToFirebase(reviewObj);
            // Updating DOM is handled via onValue callback
        } else {
            websiteReviews.unshift(reviewObj);
            localStorage.setItem('websiteReviews', JSON.stringify(websiteReviews));
            renderWebsiteReviews();
        }

        websiteReviewForm.reset();
        showNotification("Thanks a lot! Aapke website review ka bohat shukriya! ✨", "🎉");
    });
}

checkoutBtn.addEventListener('click', () => {
    cartModal.classList.add('hidden');
    checkoutModal.classList.remove('hidden');
    updateCheckoutSummary();
});
closeCheckoutBtn.addEventListener('click', () => checkoutModal.classList.add('hidden'));

function getCartSubtotal() {
    let subtotal = 0;
    for (let id in cart) {
        const qty = cart[id];
        const product = products.find(p => p.id == id);
        if (product) {
            subtotal += product.basePrice * qty;
        }
    }
    return subtotal;
}

function updateCheckoutSummary() {
    const subtotal = getCartSubtotal();
    const total = subtotal; // Delivery paid separately

    if (checkoutSubtotalEl) checkoutSubtotalEl.innerText = formatPrice(subtotal);
    if (checkoutTotalEl) checkoutTotalEl.innerText = formatPrice(total);
}

// Render cart items
function updateCartDisplay() {
    cartItemsContainer.innerHTML = '';
    let total = 0;
    
    for (let id in cart) {
        const qty = cart[id];
        const product = products.find(p => p.id == id);
        if (product) {
            total += product.basePrice * qty;
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <div>
                    <h4>${product.name}</h4>
                    <p>${formatPrice(product.basePrice)} x ${qty}</p>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn cart-minus" data-id="${id}">-</button>
                    <span class="qty-display">${qty}</span>
                    <button class="qty-btn cart-plus" data-id="${id}">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemEl);
        }
    }
    
    cartTotalPriceEl.innerText = formatPrice(total);
    attachCartEvents();
    
    // Auto-translate new cart elements to current language
    setTimeout(() => {
        translatePageContent(languageSelector.value);
    }, 50);
}

function attachCartEvents() {
    document.querySelectorAll('.cart-plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            cart[id]++;
            updateCartCount();
            updateCartDisplay();
        });
    });
    document.querySelectorAll('.cart-minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            if (cart[id] > 1) {
                cart[id]--;
            } else {
                delete cart[id]; // removes from cart
            }
            updateCartCount();
            updateCartDisplay();
        });
    });
}

// Checkout form submit
checkoutForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Clear cart and update UI
    cart = {};
    updateCartCount();
    
    // Switch to success view
    checkoutForm.classList.add('hidden');
    orderSuccessView.classList.remove('hidden');
});

closeSuccessBtn.addEventListener('click', () => {
    checkoutModal.classList.add('hidden');
    // Prepare for next order
    setTimeout(() => {
        checkoutForm.reset();
        checkoutForm.classList.remove('hidden');
        orderSuccessView.classList.add('hidden');
    }, 500);
});

// AI Chatbot Logic
const chatBtn = document.getElementById('ai-chat-btn');
const chatWindow = document.getElementById('ai-chat-window');
const closeChatBtn = document.getElementById('close-chat-window');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-user-input');
const sendChatBtn = document.getElementById('send-chat-btn');

chatBtn.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
    document.querySelector('.ai-notification-badge').style.display = 'none';
});

closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

function addChatMessage(text, isAI = true) {
    if (isAI) {
        // Show typing indicator momentarily for fastest feel but still human
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message typing-indicator';
        typingDiv.innerText = 'Mehran AI is typing...';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Fastest response: 30ms instead of 1200ms
        setTimeout(() => {
            typingDiv.remove();
            const msgDiv = document.createElement('div');
            msgDiv.className = 'ai-message';
            msgDiv.innerText = text;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Auto-translate if needed
            setTimeout(() => {
                translatePageContent(languageSelector.value);
            }, 10);
        }, 30); // Super fast typing
    } else {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'user-message';
        msgDiv.innerText = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// HUMAN INTELLIGENCE: Typo Tolerance Logic
function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

// AI Context Memory
let lastMatchedProduct = null;
let userName = null; // Human Intelligence memory

function generateAIResponse(input) {
    const query = input.toLowerCase().trim();
    const hasGreeting = ['hi', 'hello', 'hey', 'salam', 'aoa', 'asalam'].some(k => query.includes(k));
    
    // HUMAN INTELLIGENCE: Time-of-day awareness
    const currentHour = new Date().getHours();
    let timeGreeting = "Salam!";
    if (currentHour >= 5 && currentHour < 12) timeGreeting = "Subah Bakhair!";
    else if (currentHour >= 12 && currentHour < 17) timeGreeting = "Dopehar Bakhair!";
    else if (currentHour >= 17 && currentHour < 21) timeGreeting = "Sham Bakhair!";

    // Personalized situational greetings
    const pGreetings = [
        `${timeGreeting} Ji, kaise hain aap? Main Mehran AI hoon. Aaj kya khidmet karoon?`,
        `${timeGreeting} Kaise mizaaj hain? Mehran Gifts mein khush amdeed. Hum aapki kya help kar sakte hain?`,
        `${timeGreeting} Ummeed hai aap khairiyet se honge. Kya main aapko aaj ke trending items dikhaoon?`,
        `${timeGreeting} Mehran AI hazir hai. Aapki shopping experience ko behtareen banane ke liye.`
    ];
    const greetingPrefix = hasGreeting ? pGreetings[Math.floor(Math.random() * pGreetings.length)] + " " : "";

    // HUMAN INTELLIGENCE: Jokes and Humor
    if (query.includes('joke') || query.includes('latifa') || query.includes('funny') || query.includes('mazak')) {
        const jokes = [
            "Acha suniye: Ek murgi ne shopping mall mein ja kar kya pucha? 'Kya yahan ande rakhne ki tray milegi?' 😂",
            "Ek shakhs ne dukan wale se pucha, 'Bhai, ye gift kitne ka hai?'. Dukan wala bola, 'Gift nahi, mehangi dua hai ye!' 😁",
            "Teacher: Santa se pucha batao sabse zyada shopping kon karta hai? Santa: Jis ke paas credit card hota hai! 😂"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)] + " Wese agar shopping karni hai toh kya dikhaoon?";
    }

    // HUMAN INTELLIGENCE: Personal Details & Small Talk
    if (query.includes('age') || query.includes('umar') || query.includes('how old')) {
        return `Main AI hoon, umar se azad hoon, par tajarba bohat hai! ${userName ? userName + ', aap sunaye, ' : ''}kya chahiye aapko?`;
    }
    if (query.includes('kahan') || query.includes('where do you live') || query.includes('location')) {
        return "Main internet ke baadal (cloud) aur serveron ke dil mein rehti hoon! Par Mehran Gifts pure Pakistan mein deliver karta hai.";
    }

    // HUMAN INTELLIGENCE: Remember User Name
    if (query.includes('my name is') || query.includes('mera naam') || query.includes('i am')) {
        const words = query.split(' ');
        const nameKeywords = ['is', 'naam', 'am'];
        for (let i = 0; i < words.length; i++) {
            if (nameKeywords.includes(words[i]) && words[i + 1] && words[i + 1] !== 'hai') {
                userName = words[i + 1];
                userName = userName.charAt(0).toUpperCase() + userName.slice(1);
                return `MashaAllah! Bohat pyara naam hai, ${userName}! Mehran AI aap ki khidmat mein hazir hai. Boliye kya help karoon?`;
            }
        }
    }

    // HUMAN INTELLIGENCE: Sentiment and Emotion Recognition
    const sent_thanks = ['thanks', 'shukriya', 'thank', 'jazakallah', 'mehrbani'];
    if (sent_thanks.some(k => query.includes(k))) {
        return `My pleasure${userName ? ', ' + userName : ''}! Yeh toh mera farz tha. Agar mazeed kuch chahiye toh zaroor batayein.`;
    }

    const sent_compliments = ['zabardast', 'awesom', 'good', 'nice', 'best', 'great', 'wow', 'amazing', 'beautiful'];
    if (sent_compliments.some(k => query.includes(k))) {
        return `Bohat shukriya${userName ? ' ' + userName : ''}! Hum hamesha koshish karte hain ke aapko sabse behtareen quality dein.`;
    }

    const sent_complaints = ['expensive', 'mahanga', 'mehanga', 'mahnga', 'bekar', 'bad', 'stupid', 'fazool'];
    if (sent_complaints.some(k => query.includes(k))) {
        return `Maaf kijiye ga${userName ? ' ' + userName : ''}, agar aapko aesa laga. Lekin humari har item premium quality aur design ke sath aati hai, jis wajah se prices bilkul munasib hain!`;
    }

    // Small Talk & Fillers
    if (query === 'acha' || query === 'theek' || query === 'ok' || query === 'ji') {
        const fillers = ["Ji bilkul!", "Zaroor!", "Ji, toh aage kya help kar sakti hoon?", "Ji, aap jo bhi poochna chahen.", "Theek hai!"];
        return fillers[Math.floor(Math.random() * fillers.length)];
    }

    if (query.includes('kaise ho') || query.includes('how are you') || query.includes('kya haal hai')) {
        return "Alhamdulillah, main bilkul theek hoon! Bas aap jese pyaare customers ki help karne ke liye 24/7 hazir hoon. Aap sunaie, shopping ka kya irada hai?";
    }

    // 1. CONTEXTUAL MEMORY (Handling "it", "that", "uska", "uski")
    const contextKeywords = ['price of that', 'uska price', 'uski price', 'us ki price', 'how much for it', 'how much for that', 'iska rate', 'iske rate', 'iska price', 'iske price', 'iski price', 'ye kitne ka hai', 'is ki qeemat', 'iski qeemat', 'iske kitne', 'iska kitna'];
    const isContextPrice = contextKeywords.some(k => query.includes(k)) || 
                           ((query.includes('iske') || query.includes('iska') || query.includes('iski') || query.includes('is ke')) && (query.includes('price') || query.includes('rate') || query.includes('paisa') || query.includes('kitne')));
                           
    if (isContextPrice && lastMatchedProduct) {
        return `${greetingPrefix}Ji bilkul! '${lastMatchedProduct.name}' ki qeemat sirf ${formatPrice(lastMatchedProduct.basePrice)} hai. Quality aur design waqai lajawab hai. Kya main isse cart mein add kar doon?`;
    } else if (isContextPrice && !lastMatchedProduct) {
        return `${greetingPrefix}Maaf kijiye, aap kis item ke baare mein baat kar rahe hain? Pehle kisi item ka naam batayein.`;
    }

    // 2. AGGRESSIVE PLURAL & SMART PRODUCT SEARCH
    const stopWords = ['mujhe', 'mujhay', 'batao', 'dikhao', 'price', 'rate', 'qeemat', 'hai', 'kya', 'ka', 'ki', 'ke', 'aur', 'iske', 'iski', 'iska', 'yeh', 'woh', 'chahiye', 'mangta', 'please', 'plz', 'hain', 'mein', 'ko', 'se'];
    const searchWords = query.split(/[\s,?!.]+/).filter(w => w.length > 2);
    let isPluralRequest = false;
    const normalizedWords = searchWords.map(word => {
        if (word.endsWith('s') && word.length > 3) {
            isPluralRequest = true;
            return word.slice(0, -1); 
        }
        return word;
    });

    const searchKeywords = normalizedWords.filter(w => !stopWords.includes(w) && w.length > 2);

    let matchingProducts = [];
    let bestMatchedProduct = null;
    let bestScore = 0;

    if (searchKeywords.length > 0) {
        products.forEach(p => {
            const prodName = p.name.toLowerCase();
            const prodWords = prodName.split(' ').filter(w => w.length > 2);
            let score = 0;
            
            searchKeywords.forEach(sWord => {
                if (prodWords.includes(sWord)) {
                    score += 10; // Exact word match
                } else if (prodName.includes(sWord)) {
                    score += 5;  // Substring match
                } else if (prodWords.some(pWord => pWord.startsWith(sWord) || sWord.startsWith(pWord))) {
                    score += 2;  // Partial substring match at start
                } else {
                    // HUMAN INTELLIGENCE: Typo Tolerance
                    prodWords.forEach(pWord => {
                        if (Math.abs(pWord.length - sWord.length) <= 2) {
                            if (getLevenshteinDistance(pWord, sWord) <= 2) {
                                score += 3; // Minor Typo match
                            }
                        }
                    });
                }
            });

            if (score > 0) {
                matchingProducts.push(p);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatchedProduct = p;
                }
            }
        });
        
        // IMPORTANT: Ensure the chosen product is at the front of matchingProducts array for UI display
        if (bestMatchedProduct) {
            matchingProducts = [bestMatchedProduct, ...matchingProducts.filter(p => p.id !== bestMatchedProduct.id)];
        }
    }

    if (matchingProducts.length > 0) {
        const matchedProduct = matchingProducts[0];
        lastMatchedProduct = matchedProduct;

        setTimeout(() => {
            document.querySelector('[data-target="products-view"]').click();
            const filterKeyword = normalizedWords.find(word => matchedProduct.name.toLowerCase().includes(word)) || matchedProduct.name;
            searchInput.value = filterKeyword;
            filterProducts();
        }, 300);

        if (isPluralRequest && matchingProducts.length > 1) {
            return `${greetingPrefix}Ji zaroor! Maine aapke liye hamari puri '${normalizedWords.find(w => matchedProduct.name.toLowerCase().includes(w)) || 'items'}' collection nikaal di hai. Mashallah, ye saari items buhat trending hain!`;
        }

        const recommendations = products.filter(p => p.category === matchedProduct.category && p.id !== matchedProduct.id).slice(0, 2);
        const recText = recommendations.length > 0 ? ` Iske sath agar aap '${recommendations[0].name}' bhi try karein toh combination perfect rahay ga!` : "";
        const isAskingPrice = ['price', 'kitne ka', 'budget', 'rupay', 'paisa', 'cost', 'rate', 'how much', 'qeemat'].some(k => query.includes(k));

        if (isAskingPrice) {
            return `${greetingPrefix}Zaroor! '${matchedProduct.name}' ki qeemat ${formatPrice(matchedProduct.basePrice)} hai. Trust me, ye aapko bohat pasand aayega! ${recText}`;
        }
        return `${greetingPrefix}Behtareen choice! Ye raha '${matchedProduct.name}'. ${recText} Iski mazeed detail ya price bataoon?`;
    }

    // 3. Greeting Only (If no product detected)
    if (greetingPrefix.trim()) return greetingPrefix.trim();

    // 4. BUY & TRENDING INTENT
    if (['buy', 'purchase', 'kharidna', 'leina', 'order', 'chahiye', 'mangwana', 'trending', 'popular', 'mashoor', 'hit'].some(k => query.includes(k))) {
        setTimeout(() => {
            document.querySelector('[data-target="products-view"]').click();
        }, 500);
        return "Bilkul! Mere saath aaiye, main aapko hamari trending range aur poori collection dikhati hoon. Aaj kal hamari decoration items aur toppers kaafi hit jaa rahay hain!";
    }

    // 5. CATEGORY DETECTION
    if (query.includes('gift') || query.includes('tohfa')) {
        setTimeout(() => {
            document.querySelector('[data-target="products-view"]').click();
            document.querySelector('.filter-btn[data-category="Gifts"]').click();
        }, 500);
        return "Hamaray Gift Items dekh kar aapka dil khush ho jaye ga! Check karein yahan.";
    }

    // 6. PRICE & CURRENCY (General)
    if (['price', 'kitne ka', 'budget', 'rupay', 'paisa', 'cost', 'rate', 'how much', 'itne ka'].some(k => query.includes(k))) {
        return `Ji zaroor! Hamare prices Rs 200 se shuru hote hain. Agar aap kisi khas item ke baare mein puchna chahte hain, toh usko click karein ya uska naam batayein!`;
    }

    // 7. PERSONAL / CREATORS
    if (query.includes('owner') || query.includes('banaya') || query.includes('who are you') || query.includes('kon ho')) {
        return "Main Mehran AI hoon! Mujhay Zainab Sultan aur Sultan Hussain ne baray fakhar aur mehnat se banaya hai taake customer ki har mumkin madad kar saku.";
    }

    // 8. DELIVERY CHARGES
    if (['delivery', 'deliver', 'shipping', 'charges', 'pahunchane', 'fees', 'bhijwana', 'parcel'].some(k => query.includes(k))) {
        return "Delivery Bykea, TCS, ya Leopards ke zariye hoti hai. Delivery charges aapko parcel receive karte waqt direct rider ko pay karne honge (Cash on Delivery for delivery fee).";
    }

    // 9. DYNAMIC UNAVAILABILITY
    if (query.length > 3 && (query.includes('have') || query.includes('chahiye') || query.includes('hai kya') || query.includes('found'))) {
        return "I'm sorry, ye item filhal hamari collection mein nahi hai, lekin aap hamare dusre hit items check kar sakte hain!";
    }
    
    // HUMAN INTELLIGENCE: Ultimate Confident Pivot (Never say "I don't know")
    const fallbacks = [
        `Ji bilkul! Ye aesi baat hai jis par taveel guftagu ho sakti hai, lekin abhi mera bunyadi maqsad aapko humari behtareen collection dikhana hai. Aaiye main aapko apni trending list dikhati hoon!`,
        `Kya baat hai${userName ? ' ' + userName : ''}! Aapki baat waqai bohat gehri aur interesting hai. Waise is mozu ke sath sath, meri gift items ki variety bhi lajawab hai, kya aapne humare latest decors dekhe?`,
        `Ji aapne bilkul theek farmaya${userName ? ' ' + userName : ''}. Main 100% muttaliq hoon! Waise is shandaar chitchat ke sath, kya aap kisi ko gift dene ka soch rahe hain ya apne liye kuch dhoond rahe hain? Humare paas best options hain.`
    ];

    setTimeout(() => {
        document.querySelector('[data-target="products-view"]').click();
    }, 2500);

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addChatMessage(text, false);
    chatInput.value = '';
    
    // Fastest Response: 0 delay for thinking
    const response = generateAIResponse(text);
    addChatMessage(response, true);
}

sendChatBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

// Initialize
initLanguages();
renderProducts();
renderWebsiteReviews();
updateCartCount();

// --- ADVANCED 3D TILT LOGIC ---
function init3DTilt() {
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.product-card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (x > 0 && x < rect.width && y > 0 && y < rect.height) {
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 15;
                const rotateY = (centerX - x) / 15;
                
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
            } else {
                card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
            }
        });
    });
}

// --- CUSTOM CURSOR & SCROLL PROGRESS ---
function initAdvancedUI() {
    const cursor = document.getElementById('custom-cursor');
    const scrollBar = document.getElementById('scroll-progress');
    
    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });
    
    document.addEventListener('mousedown', () => cursor.classList.add('click'));
    document.addEventListener('mouseup', () => cursor.classList.remove('click'));
    
    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        scrollBar.style.width = scrolled + "%";
    });
}

// Initialize everything
window.addEventListener('DOMContentLoaded', () => {
    init3DTilt();
    initAdvancedUI();
});

// Cute Floating Animations Logic
function createFloatingItem() {
    const container = document.getElementById('cute-floating-container');
    if (!container) return;

    const item = document.createElement('div');
    item.className = 'floating-item';
    
    const aesthetics = ['🎈', '🎀', '🫧', '🧸', '💖'];
    item.innerText = aesthetics[Math.floor(Math.random() * aesthetics.length)];

    const leftPos = Math.random() * 100;
    const animDuration = 15 + Math.random() * 15;
    const sizeOffset = Math.random(); 

    item.style.left = `${leftPos}%`;
    item.style.animationDuration = `${animDuration}s`;
    item.style.transform = `scale(${0.8 + sizeOffset})`;

    container.appendChild(item);

    setTimeout(() => {
        item.remove();
    }, animDuration * 1000);
}

setInterval(createFloatingItem, 4000);
createFloatingItem();
setTimeout(createFloatingItem, 1500);
