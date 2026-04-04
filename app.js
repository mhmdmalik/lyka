const FALLBACK_PRODUCTS = [
  {
    id: "lyka-rings",
    name: "Auric Bloom Ring",
    category: "rings",
    price: 1299,
    badge: "Best for gifting",
    description: "A soft statement ring with a polished floral finish that pairs easily with both festive and daily styling.",
    details: "Lightweight ring crafted for comfortable all-day wear with a refined, giftable silhouette.",
    keywords: ["ring", "gift", "statement", "floral"],
    materials: ["Gold-tone finish", "Statement styling", "Gift-ready"],
    cover: "images/ring1.jpeg",
    gallery: [
      { src: "images/ring1.jpeg", alt: "Lyka statement ring with floral detailing" },
      { src: "images/ring2.jpeg", alt: "Lyka jewelry styling flat lay with ring accents" },
      { src: "images/ring3.jpeg", alt: "Close-up jewelry styling for Lyka ring collection" },
      { src: "images/ring4.jpeg", alt: "Close-up jewelry styling for Lyka ring collection" }
    ]
  },
  {
    id: "lyka-chains",
    name: "Signature Layered Chain",
    category: "chains",
    price: 1899,
    badge: "Most loved",
    description: "A layered chain set designed to create a luxe stacked look while staying easy to style with daily outfits.",
    details: "Ideal for festive dressing, gifting, and elevated casual looks. Pairs beautifully with neutral or jewel-toned outfits.",
    keywords: ["chain", "layered", "necklace", "festive"],
    materials: ["Layered chain look", "Event styling", "Elegant finish"],
    cover: "images/chain.jpeg",
    gallery: [
      { src: "images/chain.jpeg", alt: "Layered Lyka chain jewelry displayed on draped fabric" },
      { src: "images/chain1.jpeg", alt: "Close-up of Lyka layered chain set" },
      { src: "images/chain2.jpeg", alt: "Alternate angle of Lyka chain jewelry" },
      { src: "images/chain3.jpeg", alt: "Detailed Lyka chain styling image" }
    ]
  },
  {
    id: "lyka-earrings",
    name: "Lustre Drop Earrings",
    category: "earrings",
    price: 999,
    badge: "Everyday elegance",
    description: "Drop earrings that add a polished finish to simple outfits without feeling heavy or overdone.",
    details: "A versatile pair made for festive wear, casual styling, and thoughtful gifting when you want something timeless.",
    keywords: ["earrings", "drops", "lightweight", "everyday"],
    materials: ["Lightweight feel", "Easy styling", "Occasion-friendly"],
    cover: "images/earrings.jpeg",
    gallery: [
      { src: "images/earrings.jpeg", alt: "Lyka drop earrings styled on soft neutral fabric" },
      { src: "images/earrings1.jpeg", alt: "Close-up of Lyka earrings with polished finish" },
      { src: "images/earrings2.jpeg", alt: "Alternate angle of Lyka earrings" },
      { src: "images/earrings3.jpeg", alt: "Lyka earrings arranged for product display" }
    ]
  }
];

const CART_KEY = "lyka-cart-v1";
const NEWSLETTER_KEY = "lyka-newsletter-signups";
const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
const FIREBASE_DB_URL = "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let productCatalog = [];
let activeCollectionFilter = "all";
let collectionSearchTerm = "";
let lightboxState = { product: null, index: 0, trigger: null };
let firebaseState = {
  enabled: false,
  db: null,
  firestore: null,
  unsubscribe: null
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `product-${Date.now()}`;
}

function normalizeGallery(gallery, fallbackAlt) {
  if (!Array.isArray(gallery) || !gallery.length) {
    return [];
  }

  return gallery
    .map((image) => {
      if (typeof image === "string") {
        return { src: image, alt: fallbackAlt };
      }

      if (!image?.src) {
        return null;
      }

      return {
        src: image.src,
        alt: image.alt || fallbackAlt
      };
    })
    .filter(Boolean);
}

function normalizeProduct(rawProduct, index = 0) {
  const safeName = rawProduct?.name || `Lyka Product ${index + 1}`;
  const safeCategory = ["rings", "chains", "earrings"].includes(rawProduct?.category) ? rawProduct.category : "rings";
  const safeId = rawProduct?.id || slugify(safeName);
  const fallbackAlt = `${safeName} by Lyka Jewelry`;
  const gallery = normalizeGallery(rawProduct?.gallery, fallbackAlt);
  const cover = rawProduct?.cover || gallery[0]?.src || "images/logo.png";

  return {
    id: safeId,
    name: safeName,
    category: safeCategory,
    price: Number(rawProduct?.price) || 0,
    badge: rawProduct?.badge || "Lyka pick",
    description: rawProduct?.description || "Handcrafted jewelry piece from Lyka.",
    details: rawProduct?.details || "Elegant jewelry designed for gifting and everyday styling.",
    keywords: Array.isArray(rawProduct?.keywords) ? rawProduct.keywords : [],
    materials: Array.isArray(rawProduct?.materials) ? rawProduct.materials : [],
    cover,
    gallery: gallery.length ? gallery : [{ src: cover, alt: fallbackAlt }]
  };
}

function getProductById(id) {
  return productCatalog.find((product) => product.id === id);
}

function getFirebaseConfig() {
  return window.LYKA_FIREBASE_CONFIG || { enabled: false };
}

async function initializeFirebaseStorefront() {
  const config = getFirebaseConfig();
  if (!config.enabled || !config.projectId) {
    return;
  }

  const [{ initializeApp }, firestoreModule] = await Promise.all([
    import(FIREBASE_APP_URL),
    import(FIREBASE_DB_URL)
  ]);

  const app = initializeApp(config);
  firebaseState = {
    enabled: true,
    db: firestoreModule.getFirestore(app),
    firestore: firestoreModule,
    unsubscribe: null
  };
}

async function loadProducts() {
  if (!firebaseState.enabled) {
    productCatalog = FALLBACK_PRODUCTS.map(normalizeProduct);
    return;
  }

  const { collection, getDocs } = firebaseState.firestore;
  const snapshot = await getDocs(collection(firebaseState.db, "products"));
  const products = snapshot.docs.map((doc, index) => normalizeProduct({ id: doc.id, ...doc.data() }, index));
  productCatalog = products.length ? products : FALLBACK_PRODUCTS.map(normalizeProduct);
}

function subscribeToProductUpdates() {
  if (!firebaseState.enabled) {
    return;
  }

  const { collection, onSnapshot } = firebaseState.firestore;
  firebaseState.unsubscribe = onSnapshot(collection(firebaseState.db, "products"), (snapshot) => {
    const products = snapshot.docs.map((doc, index) => normalizeProduct({ id: doc.id, ...doc.data() }, index));
    productCatalog = products.length ? products : FALLBACK_PRODUCTS.map(normalizeProduct);
    refreshStorefront();
  });
}

function readCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(productId, quantity = 1) {
  const cart = readCart();
  const existing = cart.find((item) => item.id === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ id: productId, quantity });
  }

  writeCart(cart);
  renderCart();
}

function updateCartItem(productId, quantity) {
  const cart = readCart()
    .map((item) => item.id === productId ? { ...item, quantity } : item)
    .filter((item) => item.quantity > 0);

  writeCart(cart);
  renderCart();
}

function removeFromCart(productId) {
  writeCart(readCart().filter((item) => item.id !== productId));
  renderCart();
}

function clearCart() {
  writeCart([]);
  renderCart();
}

function cartSummary(cart) {
  return cart.reduce((summary, item) => {
    const product = getProductById(item.id);
    if (!product) {
      return summary;
    }

    summary.count += item.quantity;
    summary.total += product.price * item.quantity;
    return summary;
  }, { count: 0, total: 0 });
}

function productCardTemplate(product, options = {}) {
  const { showDetailsButton = true, enableZoom = true } = options;
  const safeCategory = product.category.charAt(0).toUpperCase() + product.category.slice(1);

  return `
    <article class="product-card" data-category="${product.category}">
      <div class="product-card__image-wrap">
        <img src="${product.cover}" alt="${product.gallery[0].alt}" loading="lazy" decoding="async">
        ${enableZoom ? `<button class="product-card__zoom" type="button" data-open-lightbox="${product.id}" aria-label="View ${product.name} image gallery">Quick view</button>` : ""}
      </div>
      <div class="product-card__body">
        <div class="product-card__topline">
          <span class="eyebrow">${safeCategory}</span>
          <span>${product.badge}</span>
        </div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-price-row">
          <strong class="product-price">${formatCurrency(product.price)}</strong>
          <span>${product.gallery.length} photos</span>
        </div>
        <div class="product-card__actions">
          ${showDetailsButton ? `<a class="button" href="product.html?id=${product.id}">View details</a>` : ""}
          <button class="button-secondary" type="button" data-add-to-cart="${product.id}">Add to cart</button>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedProducts() {
  const container = document.querySelector("[data-featured-products]");
  if (!container) {
    return;
  }

  container.innerHTML = productCatalog.slice(0, 3).map((product) => productCardTemplate(product)).join("");
}

function getFilteredProducts() {
  return productCatalog.filter((product) => {
    const categoryMatch = activeCollectionFilter === "all" || product.category === activeCollectionFilter;
    const searchBlock = [
      product.name,
      product.category,
      product.description,
      product.details,
      product.keywords.join(" "),
      product.materials.join(" ")
    ].join(" ").toLowerCase();
    const searchMatch = !collectionSearchTerm || searchBlock.includes(collectionSearchTerm);
    return categoryMatch && searchMatch;
  });
}

function renderCollectionGrid() {
  const grid = document.querySelector("[data-product-grid]");
  const emptyState = document.querySelector("[data-empty-state]");
  if (!grid) {
    return;
  }

  const filteredProducts = getFilteredProducts();
  grid.innerHTML = filteredProducts.map((product) => productCardTemplate(product)).join("");
  if (emptyState) {
    emptyState.hidden = filteredProducts.length > 0;
  }
}

function syncFilterButtons() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const isActive = button.dataset.filter === activeCollectionFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setupCollectionsPage() {
  const searchInput = document.querySelector("[data-collection-search]");
  if (!searchInput) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  activeCollectionFilter = params.get("category") || "all";
  if (!["all", "rings", "chains", "earrings"].includes(activeCollectionFilter)) {
    activeCollectionFilter = "all";
  }

  syncFilterButtons();

  searchInput.addEventListener("input", () => {
    collectionSearchTerm = searchInput.value.trim().toLowerCase();
    renderCollectionGrid();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCollectionFilter = button.dataset.filter;
      syncFilterButtons();
      renderCollectionGrid();
    });
  });
}

function createProductJsonLd(product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.gallery.map((image) => image.src.startsWith("http") ? image.src : `https://mhmdmalik.github.io/lyka/${image.src}`),
    description: product.description,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: "Lyka Jewelry"
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability: "https://schema.org/InStock",
      url: `https://mhmdmalik.github.io/lyka/product.html?id=${product.id}`
    }
  };
}

function injectProductMeta(product) {
  document.title = `${product.name} | Lyka Jewelry`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", product.description);
  }

  let structuredData = document.querySelector("[data-product-jsonld]");
  if (!structuredData) {
    structuredData = document.createElement("script");
    structuredData.type = "application/ld+json";
    structuredData.dataset.productJsonld = "true";
    document.head.appendChild(structuredData);
  }

  structuredData.textContent = JSON.stringify(createProductJsonLd(product));
}

function renderProductDetail() {
  const mount = document.querySelector("[data-product-detail]");
  if (!mount) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const product = getProductById(params.get("id")) || productCatalog[0];
  if (!product) {
    mount.innerHTML = `<p class="empty-state">This product is not available right now.</p>`;
    return;
  }

  const breadcrumb = document.querySelector("[data-product-breadcrumb]");
  if (breadcrumb) {
    breadcrumb.textContent = product.name;
  }

  injectProductMeta(product);

  mount.innerHTML = `
    <section class="detail-gallery" aria-label="${product.name} image gallery">
      <div class="detail-hero-image">
        <img src="${product.cover}" alt="${product.gallery[0].alt}" data-detail-image>
      </div>
      <div class="thumb-list" role="list">
        ${product.gallery.map((image, index) => `
          <button class="thumb-button" type="button" data-detail-thumb="${index}" aria-pressed="${index === 0 ? "true" : "false"}" aria-label="Show image ${index + 1} for ${product.name}">
            <img src="${image.src}" alt="${image.alt}" loading="lazy" decoding="async">
          </button>
        `).join("")}
      </div>
    </section>
    <section class="detail-copy">
      <span class="eyebrow">${product.badge}</span>
      <h1>${product.name}</h1>
      <p class="detail-price">${formatCurrency(product.price)}</p>
      <p>${product.description}</p>
      <p>${product.details}</p>
      <ul class="product-meta" aria-label="Product highlights">
        ${product.materials.map((material) => `<li>${material}</li>`).join("")}
      </ul>
      <div class="detail-actions">
        <div class="quantity-control" aria-label="Select quantity">
          <button type="button" data-quantity-adjust="-1" aria-label="Decrease quantity">-</button>
          <span data-quantity-value>1</span>
          <button type="button" data-quantity-adjust="1" aria-label="Increase quantity">+</button>
        </div>
        <button class="button" type="button" data-add-detail-cart="${product.id}">Add to cart</button>
        <button class="button-secondary" type="button" data-open-lightbox="${product.id}">Open gallery</button>
      </div>
    </section>
  `;

  const detailImage = mount.querySelector("[data-detail-image]");
  const thumbButtons = mount.querySelectorAll("[data-detail-thumb]");
  const quantityValue = mount.querySelector("[data-quantity-value]");
  let quantity = 1;

  thumbButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      detailImage.src = product.gallery[index].src;
      detailImage.alt = product.gallery[index].alt;
      thumbButtons.forEach((thumb, thumbIndex) => {
        thumb.setAttribute("aria-pressed", String(index === thumbIndex));
      });
    });
  });

  mount.querySelectorAll("[data-quantity-adjust]").forEach((button) => {
    button.addEventListener("click", () => {
      quantity = Math.max(1, quantity + Number(button.dataset.quantityAdjust));
      quantityValue.textContent = String(quantity);
    });
  });

  mount.querySelector("[data-add-detail-cart]")?.addEventListener("click", () => {
    addToCart(product.id, quantity);
    openCart();
  });
}

function updateLightboxView() {
  const lightbox = document.getElementById("lightbox");
  if (!lightboxState.product || !lightbox) {
    return;
  }

  const image = document.getElementById("lightbox-image");
  const title = document.getElementById("lightbox-title");
  const current = lightboxState.product.gallery[lightboxState.index];
  image.src = current.src;
  image.alt = current.alt;
  title.textContent = `${lightboxState.product.name} - ${lightboxState.index + 1} of ${lightboxState.product.gallery.length}`;
}

function openLightbox(productId, trigger) {
  const product = getProductById(productId);
  const lightbox = document.getElementById("lightbox");
  if (!product || !lightbox) {
    return;
  }

  lightboxState = {
    product,
    index: 0,
    trigger: trigger || document.activeElement
  };

  updateLightboxView();
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  lightbox.querySelector(".lightbox__close")?.focus();
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) {
    return;
  }

  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  if (lightboxState.trigger instanceof HTMLElement) {
    lightboxState.trigger.focus();
  }
}

function stepLightbox(direction) {
  if (!lightboxState.product) {
    return;
  }

  const { gallery } = lightboxState.product;
  lightboxState.index = (lightboxState.index + direction + gallery.length) % gallery.length;
  updateLightboxView();
}

function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) {
    return;
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const opener = target.closest("[data-open-lightbox]");
    if (opener) {
      openLightbox(opener.dataset.openLightbox, opener);
      return;
    }
    if (target.closest("[data-lightbox-close]")) {
      closeLightbox();
      return;
    }
    if (target.closest("[data-lightbox-next]")) {
      stepLightbox(1);
      return;
    }
    if (target.closest("[data-lightbox-prev]")) {
      stepLightbox(-1);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("is-open")) {
      return;
    }
    if (event.key === "Escape") {
      closeLightbox();
    } else if (event.key === "ArrowRight") {
      stepLightbox(1);
    } else if (event.key === "ArrowLeft") {
      stepLightbox(-1);
    }
  });
}

function cartItemTemplate(product, quantity) {
  return `
    <article class="cart-item">
      <div class="cart-item__row">
        <img class="cart-item__thumb" src="${product.cover}" alt="${product.gallery[0].alt}" loading="lazy" decoding="async">
        <div>
          <h3>${product.name}</h3>
          <p>${formatCurrency(product.price)} each</p>
          <div class="quantity-control" aria-label="Adjust quantity for ${product.name}">
            <button type="button" data-cart-adjust="${product.id}" data-step="-1" aria-label="Decrease quantity for ${product.name}">-</button>
            <span>${quantity}</span>
            <button type="button" data-cart-adjust="${product.id}" data-step="1" aria-label="Increase quantity for ${product.name}">+</button>
          </div>
          <button class="cart-item__remove" type="button" data-cart-remove="${product.id}">Remove</button>
        </div>
      </div>
    </article>
  `;
}

function renderCart() {
  const cart = readCart();
  const itemsContainer = document.querySelector("[data-cart-items]");
  const totalNode = document.querySelector("[data-cart-total]");
  const countNodes = document.querySelectorAll("[data-cart-count]");
  const summary = cartSummary(cart);

  countNodes.forEach((node) => {
    node.textContent = String(summary.count);
  });

  if (totalNode) {
    totalNode.textContent = formatCurrency(summary.total);
  }

  if (!itemsContainer) {
    return;
  }

  if (!cart.length) {
    itemsContainer.innerHTML = `<p class="empty-state">Your cart is empty. Add a product to start an inquiry-based checkout.</p>`;
    return;
  }

  itemsContainer.innerHTML = cart.map((item) => {
    const product = getProductById(item.id);
    return product ? cartItemTemplate(product, item.quantity) : "";
  }).join("");
}

function openCart() {
  const drawer = document.getElementById("cart-drawer");
  if (drawer) {
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
  }
}

function closeCart() {
  const drawer = document.getElementById("cart-drawer");
  if (drawer) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }
}

function setupCartInteractions() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const addButton = target.closest("[data-add-to-cart]");
    if (addButton) {
      addToCart(addButton.dataset.addToCart);
      openCart();
      return;
    }

    if (target.closest("[data-open-cart]")) {
      openCart();
      return;
    }

    if (target.closest("[data-close-cart]")) {
      closeCart();
      return;
    }

    const adjustButton = target.closest("[data-cart-adjust]");
    if (adjustButton) {
      const productId = adjustButton.dataset.cartAdjust;
      const item = readCart().find((entry) => entry.id === productId);
      if (item) {
        updateCartItem(productId, item.quantity + Number(adjustButton.dataset.step));
      }
      return;
    }

    const removeButton = target.closest("[data-cart-remove]");
    if (removeButton) {
      removeFromCart(removeButton.dataset.cartRemove);
      return;
    }

    if (target.closest("[data-clear-cart]")) {
      clearCart();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
    }
  });
}

function setupMenuToggle() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) {
    return;
  }

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("is-open", !expanded);
  });
}

function showStatus(node, message, state = "default") {
  if (!node) {
    return;
  }

  node.hidden = false;
  node.dataset.state = state;
  node.textContent = message;
}

function setupContactForm() {
  const form = document.querySelector("[data-contact-form]");
  const status = document.querySelector("[data-contact-status]");
  if (!form || !status) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.hidden = true;

    if (!form.reportValidity()) {
      showStatus(status, "Please complete all required fields before sending your inquiry.");
      return;
    }

    const action = form.getAttribute("action") || "";
    if (action.includes("your-form-id")) {
      showStatus(status, "Add your real Formspree form ID in index.html to activate live email delivery.", "success");
      return;
    }

    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      });

      if (!response.ok) {
        throw new Error("Unable to submit");
      }

      form.reset();
      showStatus(status, "Thanks for reaching out. Your inquiry has been sent successfully.", "success");
    } catch (error) {
      showStatus(status, "The form could not be submitted right now. Please try again later or contact Lyka via Instagram.");
    }
  });
}

function setupNewsletterForm() {
  const form = document.querySelector("[data-newsletter-form]");
  const status = document.querySelector("[data-newsletter-status]");
  if (!form || !status) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.hidden = true;

    if (!form.reportValidity()) {
      showStatus(status, "Please enter your name and a valid email address.");
      return;
    }

    const entries = JSON.parse(localStorage.getItem(NEWSLETTER_KEY) || "[]");
    const formData = new FormData(form);
    entries.push({
      name: formData.get("name"),
      email: formData.get("email"),
      joinedAt: new Date().toISOString()
    });
    localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(entries));
    form.reset();
    showStatus(status, "You have been added to the local newsletter list. Connect this form to your email platform when ready.", "success");
  });
}

function setupAnalytics() {
  const gaId = document.querySelector('meta[name="google-analytics-id"]')?.content;
  if (!gaId || gaId === "G-XXXXXXXXXX") {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", gaId);
}

function refreshStorefront() {
  renderFeaturedProducts();
  renderCollectionGrid();
  renderProductDetail();
  renderCart();
}

async function bootstrapStorefront() {
  try {
    await initializeFirebaseStorefront();
    await loadProducts();
    subscribeToProductUpdates();
  } catch (error) {
    console.error("Lyka storefront data fallback enabled:", error);
    productCatalog = FALLBACK_PRODUCTS.map(normalizeProduct);
  }

  refreshStorefront();
}

document.addEventListener("DOMContentLoaded", async () => {
  setupMenuToggle();
  setupCollectionsPage();
  setupLightbox();
  setupCartInteractions();
  setupContactForm();
  setupNewsletterForm();
  setupAnalytics();
  await bootstrapStorefront();
});
