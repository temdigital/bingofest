// components/header.js
(function() {
    function carregarHeader() {
        const placeholder = document.getElementById('header-placeholder');
        if (!placeholder) return;

        // Não carregar o header público na área administrativa
        if (window.location.pathname.includes('/admin/')) return;

        const headerHTML = `
            <nav class="navbar">
                <div class="container navbar-container">
                    <a href="./index.html" class="logo-link">
                        <img src="https://i.imgur.com/WVSr0qr.png" alt="Tem no Entorno Sul" class="logo">
                    </a>
                    <ul class="nav-menu" id="navMenu">
                        <li><a href="./index.html" class="nav-link">Home</a></li>
                        <li><a href="./publicacoes.html" class="nav-link">Publicações</a></li>
                        <li><a href="./eventos.html" class="nav-link">Eventos</a></li>
                        <li><a href="./colunistas.html" class="nav-link">Colunistas</a></li>
                        <li><a href="./parceiros.html" class="nav-link">Parceiros</a></li>
                        <li><a href="./contato.html" class="nav-link">Contato</a></li>
                        <li><a href="./admin/login.html" class="nav-link btn-login-nav">Entrar</a></li>
                    </ul>
                    <div class="hamburger" id="hamburger">
                        <i class="fas fa-bars"></i>
                    </div>
                </div>
            </nav>
        `;
        placeholder.innerHTML = headerHTML;

        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage) {
                link.classList.add('active');
            }
        });

        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                const icon = hamburger.querySelector('i');
                if (icon) {
                    icon.className = navMenu.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', carregarHeader);
    } else {
        carregarHeader();
    }
})();