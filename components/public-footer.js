// components/public-footer.js

(function () {
    'use strict';

    const LOGO_URL = 'assets/logo-tem-no-entorno-sul.png';
    const LOGO_FALLBACK = 'https://i.imgur.com/9eZarki.png';

    function renderFooter() {
        const root = document.getElementById('publicFooter');
        if (!root) return;

        const year = new Date().getFullYear();

        root.innerHTML = `
            <footer class="public-footer">
                <section class="footer-market-bar" id="footerMarketBar">
                    <div class="footer-market-container" id="footerMarketContainer">
                        <div class="market-loading">
                            <i class="fas fa-chart-line"></i>
                            Indicadores econômicos: carregando cotações...
                        </div>
                    </div>
                </section>

                <section class="footer-ad-area" aria-label="Publicidade do rodapé">
                    <ad-slot posicao="rodape"></ad-slot>
                </section>

                <section class="footer-main">
                    <div class="footer-main-container">
                        <div class="footer-grid">
                            <div class="footer-column footer-brand-column">
                                <a href="index.html" class="footer-logo-link" aria-label="Voltar ao início">
                                    <img
                                        src="${LOGO_URL}"
                                        onerror="this.src='${LOGO_FALLBACK}'"
                                        alt="Tem no Entorno Sul"
                                    >
                                </a>

                                <p>
                                    Tem no Entorno Sul — Sua fonte de notícias regional,
                                    eventos, oportunidades e empresas parceiras do Entorno Sul de Brasília.
                                </p>

                                <div class="footer-social">
                                    <a href="https://www.instagram.com/temnoentornosul" target="_blank" rel="noopener" aria-label="Instagram">
                                        <i class="fab fa-instagram"></i>
                                    </a>

                                    <a href="https://www.youtube.com/@temnoentornosul" target="_blank" rel="noopener" aria-label="YouTube">
                                        <i class="fab fa-youtube"></i>
                                    </a>

                                    <a href="https://www.temnoentornosul.com.br" target="_blank" rel="noopener" aria-label="Site oficial">
                                        <i class="fas fa-globe"></i>
                                    </a>
                                </div>
                            </div>

                            <div class="footer-column">
                                <h4>Portal</h4>
                                <ul>
                                    <li><a href="index.html">Início</a></li>
                                    <li><a href="publicacoes.html">Publicações</a></li>
                                    <li><a href="eventos.html">Eventos</a></li>
                                    <li><a href="parceiros.html">Parceiros</a></li>
                                    <li><a href="colunistas.html">Colunistas</a></li>
                                    <li><a href="comunidade.html">Comunidade</a></li>
                                    <li><a href="ranking.html">Ranking</a></li>
                                    <li><a href="pontos.html">Como funcionam os pontos</a></li>
                                </ul>
                            </div>

                            <div class="footer-column">
                                <h4>Cidades</h4>
                                <ul>
                                    <li>Valparaíso de Goiás</li>
                                    <li>Novo Gama</li>
                                    <li>Cidade Ocidental</li>
                                    <li>Luziânia</li>
                                    <li>Entorno Sul do DF</li>
                                </ul>
                            </div>

                            <div class="footer-column">
                                <h4>Acesso rápido</h4>
                                <ul>
                                    <li><a href="login.html">Entrar</a></li>
                                    <li><a href="cadastro.html">Criar conta</a></li>
                                    <li><a href="favoritos.html">Favoritos</a></li>
                                    <li><a href="pontos.html">Pontos e ranking</a></li>
                                    <li><a href="perfil.html">Meu perfil</a></li>
                                    <li><a href="recuperar-senha.html">Recuperar senha</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="footer-bottom">
                    <div class="footer-bottom-container">
                        <p>© ${year} Tem no Entorno Sul. Todos os direitos reservados.</p>
                        <div class="footer-bottom-links">
                            <a href="index.html">Site oficial</a>
                            <a href="comunidade.html">Comunidade</a>
                            <a href="parceiros.html">Empresas parceiras</a>
                            <a href="privacidade.html">Privacidade</a>
                            <a href="termos.html">Termos</a>
                            <a href="pontos.html">Pontos e ranking</a>
                            <a href="remocao.html">Solicitar remoção</a>
                        </div>
                    </div>
                </section>
            </footer>
        `;

        loadMarketData();
    }

    async function loadMarketData() {
        const container = document.getElementById('footerMarketContainer');
        if (!container) return;

        try {
            const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL');
            if (!response.ok) throw new Error('Falha ao carregar indicadores.');

            const data = await response.json();
            const dolar = data.USDBRL;
            const euro = data.EURBRL;
            const bitcoin = data.BTCBRL;

            container.innerHTML = `
                <div class="market-item market-title">
                    <i class="fas fa-chart-line"></i>
                    <div><strong>Indicadores econômicos</strong><span>Cotações em tempo real</span></div>
                </div>

                <div class="market-item">
                    <i class="fas fa-dollar-sign"></i>
                    <div><strong>Dólar</strong><span>R$ ${Number(dolar.bid).toFixed(2)}</span></div>
                </div>

                <div class="market-item">
                    <i class="fas fa-euro-sign"></i>
                    <div><strong>Euro</strong><span>R$ ${Number(euro.bid).toFixed(2)}</span></div>
                </div>

                <div class="market-item">
                    <i class="fab fa-bitcoin"></i>
                    <div><strong>Bitcoin</strong><span>R$ ${Number(bitcoin.bid).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></div>
                </div>

                <div class="market-item">
                    <i class="fas fa-clock"></i>
                    <div><strong>Atualização</strong><span>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
            `;
        } catch (error) {
            console.warn('[PUBLIC FOOTER MARKET]', error);
            container.innerHTML = `
                <div class="market-item">
                    <i class="fas fa-circle-info"></i>
                    <div><strong>Mercado</strong><span>Indicadores temporariamente indisponíveis</span></div>
                </div>
            `;
        }
    }

    document.addEventListener('DOMContentLoaded', renderFooter);
})();
