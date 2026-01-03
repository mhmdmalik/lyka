
// Define collections
const galleries = {
  rings: ["images/rings1.jpeg", "images/rings2.jpeg", "images/rings3.jpeg"],
  chains: ["images/chain1.jpeg", "images/chain2.jpeg", "images/chain3.jpeg", "images/chain4.jpeg", "images/chain5.jpeg"],
  earrings: ["images/earrings1.jpeg", "images/earrings2.jpeg", "images/earrings3.jpeg", "images/earrings4.jpeg", "images/earrings5.jpeg"]
};

let currentGallery = [];
let currentIndex = 0;

function openLightbox(categoryOrSrc) {
  if (galleries[categoryOrSrc]) {
    currentGallery = galleries[categoryOrSrc];
    currentIndex = 0;
  } else {
    currentGallery = [categoryOrSrc];
    currentIndex = 0;
  }
  document.getElementById("lightbox-img").src = currentGallery[currentIndex];
  document.getElementById("lightbox").classList.add("show"); // ✅ use class
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("show"); // ✅ hide again
}


function nextImage() {
  currentIndex = (currentIndex + 1) % currentGallery.length;
  document.getElementById("lightbox-img").src = currentGallery[currentIndex];
}

function prevImage() {
  currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
  document.getElementById("lightbox-img").src = currentGallery[currentIndex];
}