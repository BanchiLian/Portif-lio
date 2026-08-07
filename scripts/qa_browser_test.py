"""QA end-to-end do portfolio usando um navegador real (Playwright/Chromium).

Sobe um servidor HTTP estatico local servindo a raiz do repositorio e
percorre a pagina principal e os quatro sub-projetos, verificando:
  - ausencia de erros JavaScript (pageerror) e de recursos proprios que
    falham ao carregar (404/erro de rede em same-origin);
  - os fluxos de interacao centrais de cada pagina (navegacao por secao,
    tema escuro, carrinho, formularios, etc.);
  - uma captura de tela por pagina para inspecao visual.

Uso:
    python scripts/qa_browser_test.py [--headed] [--keep-server]

Saida: relatorio no terminal e screenshots em scripts/qa-screenshots/.
Encerra com codigo de saida 1 se algum teste falhar.
"""
from __future__ import annotations

import argparse
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = Path(__file__).resolve().parent / "qa-screenshots"

# Recursos de terceiros que sabidamente dependem de rede externa e nao
# devem reprovar o teste quando o ambiente de execucao nao tem acesso
# (ex.: CI isolado). Falhas nesses hosts viram aviso, nao falha.
EXTERNAL_HOST_HINTS = (
    "fonts.googleapis.com", "fonts.gstatic.com", "images.unsplash.com",
    "images.pexels.com", "open-meteo.com", "wger.de", "cdn.jsdelivr.net",
    "wa.me",
)


@dataclass
class CheckResult:
    page: str
    name: str
    status: str  # PASS | FAIL | WARN
    detail: str = ""


@dataclass
class PageProbe:
    errors: list[str] = field(default_factory=list)
    console_errors: list[str] = field(default_factory=list)
    failed_requests: list[str] = field(default_factory=list)

    def attach(self, page: Page) -> None:
        page.on("pageerror", lambda exc: self.errors.append(str(exc)))
        page.on(
            "console",
            lambda msg: self.console_errors.append(msg.text) if msg.type == "error" else None,
        )

        def on_failed(request):
            is_external = any(host in request.url for host in EXTERNAL_HOST_HINTS)
            entry = f"{request.method} {request.url} -> {request.failure}"
            if not is_external:
                self.failed_requests.append(entry)

        page.on("requestfailed", on_failed)


def is_whatsapp_url(url: str, phone: str, *expected_text_fragments: str) -> bool:
    """Aceita tanto o link direto wa.me quanto o destino apos o redirect
    (api.whatsapp.com/send/...), ja que o navegador segue o redirect antes
    de expor `popup.url`. Isso e o comportamento correto do link, nao um bug."""
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc not in ("wa.me", "api.whatsapp.com"):
        return False
    query = urllib.parse.parse_qs(parsed.query)
    text = query.get("text", [""])[0]
    if parsed.netloc == "wa.me":
        phone_ok = parsed.path.lstrip("/").startswith(phone)
    else:
        phone_ok = query.get("phone", [""])[0] == phone
    return phone_ok and all(fragment in text for fragment in expected_text_fragments)


results: list[CheckResult] = []


def record(page_name: str, name: str, ok: bool, detail: str = "", warn: bool = False) -> bool:
    status = "PASS" if ok else ("WARN" if warn else "FAIL")
    results.append(CheckResult(page_name, name, status, detail))
    marker = {"PASS": "OK  ", "WARN": "WARN", "FAIL": "FAIL"}[status]
    print(f"  [{marker}] {name}" + (f" — {detail}" if detail else ""))
    return ok


def report_probe(page_name: str, probe: PageProbe) -> None:
    record(page_name, "Sem erros de JavaScript (pageerror)", not probe.errors,
           "; ".join(probe.errors)[:300])
    record(page_name, "Sem erros no console", not probe.console_errors,
           "; ".join(probe.console_errors)[:300])
    record(page_name, "Sem falhas de rede em recursos proprios", not probe.failed_requests,
           "; ".join(probe.failed_requests)[:300])


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for_server(url: str, timeout: float = 15.0) -> None:
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1).read(1)
            return
        except Exception as exc:  # noqa: BLE001 - so estamos fazendo polling
            last_error = exc
            time.sleep(0.3)
    raise RuntimeError(f"Servidor local nao respondeu em {timeout}s ({last_error})")


@contextmanager
def local_server():
    port = find_free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        wait_for_server(base_url + "/index.html")
        yield base_url
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def screenshot(page: Page, name: str) -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SCREENSHOT_DIR / f"{name}.png"), full_page=True)


# ---------------------------------------------------------------------------
# Testes: pagina principal (index.html)
# ---------------------------------------------------------------------------

def test_home(context: BrowserContext, base_url: str) -> None:
    name = "index.html"
    print(f"\n== {name} ==")
    page = context.new_page()
    probe = PageProbe()
    probe.attach(page)
    page.goto(f"{base_url}/index.html", wait_until="networkidle", timeout=30000)

    record(name, "Titulo da pagina correto",
           page.title() == "Elian Mori | Desenvolvedor Web", page.title())

    viewport_content = page.get_attribute('meta[name="viewport"]', "content") or ""
    record(name, "Viewport nao bloqueia zoom (a11y)",
           "user-scalable=no" not in viewport_content and "maximum-scale" not in viewport_content,
           viewport_content)

    css_ok = page.evaluate(
        "!!Array.from(document.styleSheets).find(s => s.href && s.href.includes('assets/css/style.css'))"
    )
    record(name, "assets/css/style.css carregado", css_ok)

    hero_display = page.eval_on_selector("#section-inicio", "el => getComputedStyle(el).display")
    record(name, "Secao inicial (#section-inicio) usa layout flex", hero_display == "flex", hero_display)

    sections = ["sobre", "habilidades", "projetos", "curriculo", "contato", "inicio"]
    nav_ok = True
    for section_id in sections:
        page.click(f'.nav-btn[data-section="{section_id}"]')
        page.wait_for_timeout(150)
        active_count = page.eval_on_selector_all(".content-section.active", "els => els.length")
        target_active = page.eval_on_selector(
            f"#section-{section_id}", "el => el.classList.contains('active')"
        )
        current_hash = urllib.parse.urlparse(page.url).fragment
        step_ok = active_count == 1 and target_active and current_hash == section_id
        nav_ok = nav_ok and step_ok
        if not step_ok:
            record(name, f"Navegacao para #{section_id}", False,
                   f"active_count={active_count} target_active={target_active} hash={current_hash}")
    record(name, "Navegacao por todas as secoes troca exatamente uma secao ativa por vez", nav_ok)

    is_dark_before = page.eval_on_selector("body", "el => el.classList.contains('dark-mode')")
    page.click("#btn-theme")
    page.wait_for_timeout(100)
    is_dark_after = page.eval_on_selector("body", "el => el.classList.contains('dark-mode')")
    stored_theme = page.evaluate("localStorage.getItem('preferred-theme')")
    record(name, "Toggle de tema escuro altera classe do body e persiste no localStorage",
           is_dark_after != is_dark_before and stored_theme == ("dark" if is_dark_after else "light"),
           f"antes={is_dark_before} depois={is_dark_after} storage={stored_theme}")
    page.click("#btn-theme")  # volta ao estado original
    page.wait_for_timeout(100)

    page.set_viewport_size({"width": 1440, "height": 900})
    page.click("#btn-toggle-menu")
    page.wait_for_timeout(100)
    collapsed = page.eval_on_selector("#sidebar", "el => el.classList.contains('collapsed')")
    expanded = page.eval_on_selector("#main-content", "el => el.classList.contains('expanded')")
    record(name, "Toggle do menu lateral (desktop) colapsa sidebar e expande conteudo",
           collapsed and expanded, f"collapsed={collapsed} expanded={expanded}")
    page.click("#btn-toggle-menu")
    page.wait_for_timeout(100)

    expected_links = {
        "./projects/dashboard-financeiro/index.html",
        "./projects/clima/index.html",
        "./projects/loja-nexus/index.html",
        "./projects/App%20treino/index.html",
    }
    hrefs = set(page.eval_on_selector_all(
        ".project-actions .btn-demo", "els => els.map(e => e.getAttribute('href'))"
    ))
    record(name, "Links dos 4 cards de projeto apontam para os caminhos esperados",
           expected_links.issubset(hrefs), str(hrefs))

    page.click('.nav-btn[data-section="contato"]')
    page.wait_for_timeout(150)
    page.fill("#contact-name", "QA Automatizado")
    page.fill("#contact-email", "qa@example.com")
    page.fill("#contact-message", "Mensagem de teste do script de QA.")
    try:
        with context.expect_page(timeout=5000) as popup_info:
            page.click(".btn-submit")
        popup = popup_info.value
        popup.wait_for_load_state("domcontentloaded", timeout=8000)
        popup_url = popup.url
        popup.close()
        ok = is_whatsapp_url(popup_url, "5519999324368", "QA Automatizado", "qa@example.com")
        record(name, "Formulario de contato abre WhatsApp com os dados preenchidos", ok, popup_url)
    except Exception as exc:  # noqa: BLE001
        record(name, "Formulario de contato abre WhatsApp com os dados preenchidos", False, str(exc))

    report_probe(name, probe)
    screenshot(page, "01-home-desktop")

    mobile_page = context.new_page()
    mobile_probe = PageProbe()
    mobile_probe.attach(mobile_page)
    mobile_page.set_viewport_size({"width": 390, "height": 844})
    mobile_page.goto(f"{base_url}/index.html", wait_until="networkidle", timeout=30000)
    no_horizontal_scroll = mobile_page.evaluate(
        "document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"
    )
    record(name, "Sem scroll horizontal indevido em viewport mobile (390px)", no_horizontal_scroll)
    screenshot(mobile_page, "02-home-mobile")
    mobile_page.close()
    page.close()


# ---------------------------------------------------------------------------
# Testes: Nexus Finance (dashboard-financeiro)
# ---------------------------------------------------------------------------

def test_dashboard_financeiro(context: BrowserContext, base_url: str) -> None:
    name = "dashboard-financeiro"
    print(f"\n== {name} ==")
    page = context.new_page()
    probe = PageProbe()
    probe.attach(page)
    page.goto(f"{base_url}/projects/dashboard-financeiro/index.html", wait_until="networkidle", timeout=30000)

    balance_text = page.inner_text("#main-balance")
    record(name, "Saldo inicial renderizado em R$", "R$" in balance_text, balance_text)

    page.click('[data-open="transaction-modal"]')
    page.wait_for_timeout(150)
    modal_open = page.eval_on_selector("#transaction-modal", "el => el.open")
    record(name, "Modal de novo lancamento abre", bool(modal_open))

    page.fill("#tx-description", "Teste QA")
    page.fill("#tx-amount", "123.45")
    page.click('#transaction-form button[type="submit"]')
    page.wait_for_timeout(200)

    recent_text = page.inner_text("#recent-list")
    kpi_expense = page.inner_text("#kpi-expense")
    record(name, "Lancamento de teste aparece nos ultimos lancamentos", "Teste QA" in recent_text, recent_text[:200])
    record(name, "KPI de saidas reflete o valor lancado (123,45)", "123,45" in kpi_expense, kpi_expense)

    report_probe(name, probe)
    screenshot(page, "03-dashboard-financeiro")
    page.close()


# ---------------------------------------------------------------------------
# Testes: NexusWeather (clima)
# ---------------------------------------------------------------------------

def test_clima(context: BrowserContext, base_url: str) -> None:
    name = "clima"
    print(f"\n== {name} ==")
    page = context.new_page()
    probe = PageProbe()
    probe.attach(page)
    page.goto(f"{base_url}/projects/clima/index.html", wait_until="load", timeout=30000)

    try:
        page.wait_for_function(
            "!['Carregando...', 'Atualizando...', ''].includes(document.getElementById('detCond').textContent)",
            timeout=15000,
        )
        cond_text = page.inner_text("#detCond")
        record(name, "Previsao do tempo carregada via API (Open-Meteo)", True, cond_text)
    except Exception:
        cond_text = page.inner_text("#detCond")
        record(name, "Previsao do tempo carregada via API (Open-Meteo)", False,
               f"API nao respondeu a tempo (texto atual: '{cond_text}') — verificar rede/host externo, "
               "nao necessariamente um bug do app", warn=True)

    page.click(".nav-icon >> text=☰")
    page.wait_for_timeout(600)
    list_transform = page.eval_on_selector(
        "#listView", "el => getComputedStyle(el).transform"
    )
    record(name, "Alternar para lista de cidades move a view para tela (translateX)",
           list_transform != "none", list_transform)

    try:
        page.wait_for_selector("#citiesListContainer .city-card", timeout=10000)
        city_cards = page.eval_on_selector_all("#citiesListContainer .city-card", "els => els.length")
        record(name, "Lista de cidades salvas renderiza os cartoes com clima", city_cards > 0, str(city_cards))
    except Exception:
        record(name, "Lista de cidades salvas renderiza os cartoes com clima", False,
               "cartoes nao apareceram a tempo — possivel falha da API de geocodificacao/previsao",
               warn=True)

    report_probe(name, probe)
    screenshot(page, "04-clima")
    page.close()


# ---------------------------------------------------------------------------
# Testes: Nexus Setup (loja-nexus)
# ---------------------------------------------------------------------------

def test_loja_nexus(context: BrowserContext, base_url: str) -> None:
    name = "loja-nexus"
    print(f"\n== {name} ==")
    page = context.new_page()
    probe = PageProbe()
    probe.attach(page)
    page.goto(f"{base_url}/projects/loja-nexus/index.html", wait_until="networkidle", timeout=30000)

    product_count = page.eval_on_selector_all(".product-card", "els => els.length")
    record(name, "Grid de produtos renderiza os 8 itens do catalogo", product_count == 8, str(product_count))

    page.click(".product-card .add-button")
    page.wait_for_timeout(150)
    cart_count = page.inner_text("#cartCount")
    record(name, "Adicionar produto atualiza o contador do carrinho", cart_count == "1", cart_count)

    page.click("#openCart")
    page.wait_for_timeout(200)
    drawer_open = page.eval_on_selector("#cartDrawer", "el => el.classList.contains('open')")
    record(name, "Carrinho abre ao clicar no botao", bool(drawer_open))

    try:
        with context.expect_page(timeout=5000) as popup_info:
            page.click("#checkoutButton")
        popup = popup_info.value
        popup.wait_for_load_state("domcontentloaded", timeout=8000)
        popup_url = popup.url
        popup.close()
        ok = is_whatsapp_url(popup_url, "5519999324368", "NexusBoard Pro 75")
        record(name, "Checkout abre WhatsApp com o orcamento", ok, popup_url)
    except Exception as exc:  # noqa: BLE001
        record(name, "Checkout abre WhatsApp com o orcamento", False, str(exc))

    report_probe(name, probe)
    screenshot(page, "05-loja-nexus")
    page.close()


# ---------------------------------------------------------------------------
# Testes: Vö Performance (App treino)
# ---------------------------------------------------------------------------

def test_app_treino(context: BrowserContext, base_url: str) -> None:
    name = "App treino"
    print(f"\n== {name} ==")
    page = context.new_page()
    probe = PageProbe()
    probe.attach(page)
    page.goto(f"{base_url}/projects/App%20treino/index.html", wait_until="networkidle", timeout=30000)

    workout_html = page.inner_html("#todayWorkoutCard")
    record(name, "Card de treino do dia renderiza conteudo", len(workout_html.strip()) > 0)

    page.click('.nav-button[data-target="plan"]')
    page.wait_for_timeout(200)
    day_cards = page.eval_on_selector_all("#planEditor .day-card", "els => els.length")
    record(name, "Editor de plano semanal renderiza os 7 dias", day_cards == 7, str(day_cards))

    page.click('.nav-button[data-target="nutrition"]')
    page.wait_for_timeout(200)
    nutrition_groups = page.eval_on_selector_all("#nutritionPlan .nutrition-group", "els => els.length")
    record(name, "Plano nutricional padrao renderiza refeicoes", nutrition_groups > 0, str(nutrition_groups))

    report_probe(name, probe)
    screenshot(page, "06-app-treino")
    page.close()


def print_summary() -> int:
    total = len(results)
    passed = sum(1 for r in results if r.status == "PASS")
    warned = sum(1 for r in results if r.status == "WARN")
    failed = [r for r in results if r.status == "FAIL"]

    print("\n" + "=" * 70)
    print(f"RESUMO: {passed}/{total} passaram, {warned} aviso(s), {len(failed)} falha(s)")
    print("=" * 70)
    if failed:
        print("\nFalhas:")
        for r in failed:
            print(f"  - [{r.page}] {r.name}: {r.detail}")
    print(f"\nScreenshots salvos em: {SCREENSHOT_DIR}")
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--headed", action="store_true", help="Roda o navegador com interface visivel")
    args = parser.parse_args()

    with local_server() as base_url:
        print(f"Servidor local em {base_url}")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=not args.headed)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            try:
                test_home(context, base_url)
                test_dashboard_financeiro(context, base_url)
                test_clima(context, base_url)
                test_loja_nexus(context, base_url)
                test_app_treino(context, base_url)
            finally:
                context.close()
                browser.close()

    return print_summary()


if __name__ == "__main__":
    sys.exit(main())
