// components/footer.js
(function() {
    function carregarFooter() {
        const placeholder = document.getElementById('footer-placeholder');
        if (!placeholder) return;

        if (window.location.pathname.includes('/admin/')) return;

        const footerHTML = `
            <footer class="footer">
                <div class="container footer-container">
                    <div class="footer-col">
                        <img src="https://i.imgur.com/lD6krRL.png" alt="Tem no Entorno Sul" class="footer-logo" loading="lazy">
                        <p class="footer-description">O seu portal de notícias e eventos do Entorno Sul. Trazendo informação relevante e de qualidade para toda a região.</p>
                        <div class="social-links">
                            <a href="https://www.facebook.com/temnoentornosul" class="social-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-facebook-f"></i></a>
                            <a href="https://www.instagram.com/temnoentornosul" class="social-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-instagram"></i></a>
                            <a href="https://www.youtube.com/@temnoentornosul" class="social-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-youtube"></i></a>
                        </div>
                    </div>
                    <div class="footer-col">
                        <h3 class="footer-title">Links Rápidos</h3>
                        <ul class="footer-links">
                            <li><a href="./index.html">Home</a></li>
                            <li><a href="./publicacoes.html">Publicações</a></li>
                            <li><a href="./eventos.html">Eventos</a></li>
                            <li><a href="./colunistas.html">Colunistas</a></li>
                            <li><a href="./parceiros.html">Parceiros</a></li>
                            <li><a href="./contato.html">Contato</a></li>
                        </ul>
                    </div>
                    <div class="footer-col">
                        <h3 class="footer-title">Newsletter</h3>
                        <p class="footer-description">Junte-se ao nosso grupo do WhatsApp para receber as novidades do Entorno Sul em tempo real.</p>
                        <div class="footer-form">
                            <button id="whatsapp-group-btn" class="btn btn-accent" style="margin-top: 10px; width: 100%;">
                                <i class="fab fa-whatsapp"></i> Entrar no Grupo
                            </button>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2026 Tem no Entorno Sul. Todos os direitos reservados.</p>
                </div>
            </footer>
        `;
        placeholder.innerHTML = footerHTML;

        const whatsappBtn = document.getElementById('whatsapp-group-btn');
        if (whatsappBtn) {
            whatsappBtn.addEventListener('click', () => {
                window.open('https://chat.whatsapp.com/DvTQra8rDQp01NqUCmwa8N', '_blank');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', carregarFooter);
    } else {
        carregarFooter();
    }
})();