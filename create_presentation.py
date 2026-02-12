#!/usr/bin/env python3
"""
Script para criar apresentação PowerPoint do CorrectMe
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor
import os

# Cores do tema CorrectMe
PURPLE = RGBColor(168, 85, 247)    # #a855f7
PINK = RGBColor(236, 72, 153)      # #ec4899
DARK_BG = RGBColor(15, 10, 31)     # #0f0a1f
DARK_700 = RGBColor(37, 28, 69)    # #251c45
WHITE = RGBColor(255, 255, 255)
GRAY = RGBColor(156, 163, 175)
GREEN = RGBColor(34, 197, 94)
BLUE = RGBColor(59, 130, 246)
ORANGE = RGBColor(249, 115, 22)
RED = RGBColor(239, 68, 68)
YELLOW = RGBColor(234, 179, 8)

# Diretório base
BASE_DIR = "/home/user/Correctmemycleverbot"
IMAGES_DIR = os.path.join(BASE_DIR, "images")

def add_title_slide(prs):
    """Slide 1: Título principal"""
    slide_layout = prs.slide_layouts[6]  # Blank
    slide = prs.slides.add_slide(slide_layout)

    # Background escuro
    background = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height
    )
    background.fill.solid()
    background.fill.fore_color.rgb = DARK_BG
    background.line.fill.background()

    # Logo
    logo_path = os.path.join(IMAGES_DIR, "LogobrancofundoTransparentev1.png")
    if os.path.exists(logo_path):
        slide.shapes.add_picture(logo_path, Inches(3.5), Inches(0.5), height=Inches(1.5))

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(2.3), Inches(9), Inches(1))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "CorrectMe"
    p.font.size = Pt(60)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    # Subtítulo
    subtitle_box = slide.shapes.add_textbox(Inches(0.5), Inches(3.3), Inches(9), Inches(0.8))
    tf = subtitle_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Correção de Redações em Alemão com IA"
    p.font.size = Pt(28)
    p.font.color.rgb = PURPLE
    p.alignment = PP_ALIGN.CENTER

    # Descrição
    desc_box = slide.shapes.add_textbox(Inches(1), Inches(4.3), Inches(8), Inches(1))
    tf = desc_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "Plataforma de aprendizado de alemão com inteligência artificial para brasileiros"
    p.font.size = Pt(18)
    p.font.color.rgb = GRAY
    p.alignment = PP_ALIGN.CENTER

def add_stats_slide(prs):
    """Slide 2: Estatísticas"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(9), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Números que Impressionam"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    # Stats cards
    stats = [
        ("+60", "Tópicos de Gramática", PINK),
        ("+50", "Temas de Conversa", PURPLE),
        ("5", "Categorias de Erros", BLUE),
        ("24/7", "Disponível Sempre", GREEN),
    ]

    card_width = Inches(2)
    card_height = Inches(2)
    start_x = Inches(0.75)
    y = Inches(2)
    gap = Inches(0.3)

    for i, (number, label, color) in enumerate(stats):
        x = start_x + i * (card_width + gap)

        # Card background
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, card_width, card_height)
        card.fill.solid()
        card.fill.fore_color.rgb = DARK_700
        card.line.color.rgb = color
        card.line.width = Pt(2)

        # Number
        num_box = slide.shapes.add_textbox(x, y + Inches(0.4), card_width, Inches(0.8))
        tf = num_box.text_frame
        p = tf.paragraphs[0]
        p.text = number
        p.font.size = Pt(40)
        p.font.bold = True
        p.font.color.rgb = color
        p.alignment = PP_ALIGN.CENTER

        # Label
        lbl_box = slide.shapes.add_textbox(x, y + Inches(1.2), card_width, Inches(0.6))
        tf = lbl_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = label
        p.font.size = Pt(14)
        p.font.color.rgb = GRAY
        p.alignment = PP_ALIGN.CENTER

def add_feature_slide(prs, title, subtitle, description, bullets, image_name, accent_color):
    """Template para slides de features"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Tag
    tag_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(4), Inches(0.4))
    tf = tag_box.text_frame
    p = tf.paragraphs[0]
    p.text = subtitle
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = accent_color

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.7), Inches(4.5), Inches(0.8))
    tf = title_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = WHITE

    # Descrição
    desc_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.6), Inches(4.5), Inches(1))
    tf = desc_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = description
    p.font.size = Pt(14)
    p.font.color.rgb = GRAY

    # Bullets
    bullet_box = slide.shapes.add_textbox(Inches(0.5), Inches(2.7), Inches(4.5), Inches(2.5))
    tf = bullet_box.text_frame
    tf.word_wrap = True

    for i, bullet in enumerate(bullets):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = f"• {bullet}"
        p.font.size = Pt(13)
        p.font.color.rgb = WHITE
        p.space_after = Pt(8)

    # Imagem
    img_path = os.path.join(IMAGES_DIR, image_name)
    if os.path.exists(img_path):
        try:
            slide.shapes.add_picture(img_path, Inches(5.2), Inches(0.8), width=Inches(4.5))
        except Exception as e:
            print(f"Erro ao adicionar imagem {image_name}: {e}")

def add_categories_slide(prs):
    """Slide: Categorias de Erros"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(9), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "5 Categorias de Erros"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    subtitle_box = slide.shapes.add_textbox(Inches(0.5), Inches(1), Inches(9), Inches(0.5))
    tf = subtitle_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Cada tipo de erro é destacado com uma cor diferente"
    p.font.size = Pt(16)
    p.font.color.rgb = GRAY
    p.alignment = PP_ALIGN.CENTER

    categories = [
        ("Declinação", "Genus, Numerus, Kasus", PINK),
        ("Conjugação", "Tempos verbais", PURPLE),
        ("Preposições", "Uso correto de preposições", BLUE),
        ("Sintaxe", "Estrutura das frases", ORANGE),
        ("Vocabulário", "Escolha de palavras", GREEN),
    ]

    y_start = Inches(1.8)
    for i, (name, desc, color) in enumerate(categories):
        y = y_start + i * Inches(0.85)

        # Círculo colorido
        circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(2.5), y, Inches(0.35), Inches(0.35))
        circle.fill.solid()
        circle.fill.fore_color.rgb = color
        circle.line.fill.background()

        # Nome da categoria
        name_box = slide.shapes.add_textbox(Inches(3), y, Inches(2.5), Inches(0.4))
        tf = name_box.text_frame
        p = tf.paragraphs[0]
        p.text = name
        p.font.size = Pt(20)
        p.font.bold = True
        p.font.color.rgb = WHITE

        # Descrição
        desc_box = slide.shapes.add_textbox(Inches(5.5), y, Inches(3), Inches(0.4))
        tf = desc_box.text_frame
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(16)
        p.font.color.rgb = GRAY

def add_how_it_works_slide(prs):
    """Slide: Como Funciona"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(9), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Como Funciona"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    subtitle = slide.shapes.add_textbox(Inches(0.5), Inches(1), Inches(9), Inches(0.5))
    tf = subtitle.text_frame
    p = tf.paragraphs[0]
    p.text = "Em 3 passos simples"
    p.font.size = Pt(18)
    p.font.color.rgb = PURPLE
    p.alignment = PP_ALIGN.CENTER

    steps = [
        ("1", "Escreva seu texto", "Cole ou digite sua redação em alemão. Escolha seu nível: A1 a C2.", PINK),
        ("2", "Receba a análise", "Nossa IA corrige erros, explica a gramática e cria exercícios personalizados.", PURPLE),
        ("3", "Acompanhe a evolução", "Visualize seu progresso, pratique com flashcards e melhore continuamente.", GREEN),
    ]

    card_width = Inches(2.8)
    start_x = Inches(0.65)
    y = Inches(2)
    gap = Inches(0.25)

    for i, (num, title, desc, color) in enumerate(steps):
        x = start_x + i * (card_width + gap)

        # Card
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, card_width, Inches(2.8))
        card.fill.solid()
        card.fill.fore_color.rgb = DARK_700
        card.line.color.rgb = color
        card.line.width = Pt(1)

        # Número
        num_circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, x + Inches(0.95), y + Inches(0.2), Inches(0.7), Inches(0.7))
        num_circle.fill.solid()
        num_circle.fill.fore_color.rgb = color
        num_circle.line.fill.background()

        num_box = slide.shapes.add_textbox(x + Inches(0.95), y + Inches(0.25), Inches(0.7), Inches(0.7))
        tf = num_box.text_frame
        p = tf.paragraphs[0]
        p.text = num
        p.font.size = Pt(28)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

        # Título do passo
        step_title = slide.shapes.add_textbox(x + Inches(0.15), y + Inches(1), card_width - Inches(0.3), Inches(0.5))
        tf = step_title.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

        # Descrição
        step_desc = slide.shapes.add_textbox(x + Inches(0.15), y + Inches(1.5), card_width - Inches(0.3), Inches(1.2))
        tf = step_desc.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(12)
        p.font.color.rgb = GRAY
        p.alignment = PP_ALIGN.CENTER

def add_comparison_slide(prs):
    """Slide: Comparação com concorrentes"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.2), Inches(9), Inches(0.6))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Por que escolher o CorrectMe?"
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    # Tabela de comparação (simulada com shapes)
    headers = ["Recurso", "CorrectMe", "LanguageTool", "Scribbr"]
    rows = [
        ["Especializado em alemão", "✓ 100%", "Parcial", "Parcial"],
        ["Feedback pedagógico", "✓", "✗", "Limitado"],
        ["Categorização de erros", "✓", "✗", "✗"],
        ["Níveis A1 a C2", "✓", "✗", "✗"],
        ["Flashcards integrados", "✓", "✗", "✗"],
        ["Listas de vocabulário", "✓", "✗", "✗"],
        ["Chatbot para dúvidas", "✓", "✗", "✗"],
    ]

    start_y = Inches(0.9)
    row_height = Inches(0.45)
    col_widths = [Inches(2.8), Inches(2), Inches(2.2), Inches(2)]
    start_x = Inches(0.5)

    # Headers
    x = start_x
    for i, header in enumerate(headers):
        box = slide.shapes.add_textbox(x, start_y, col_widths[i], row_height)
        tf = box.text_frame
        p = tf.paragraphs[0]
        p.text = header
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = PURPLE if i == 1 else WHITE
        p.alignment = PP_ALIGN.CENTER if i > 0 else PP_ALIGN.LEFT
        x += col_widths[i]

    # Rows
    for row_idx, row in enumerate(rows):
        y = start_y + (row_idx + 1) * row_height
        x = start_x
        for col_idx, cell in enumerate(row):
            box = slide.shapes.add_textbox(x, y, col_widths[col_idx], row_height)
            tf = box.text_frame
            p = tf.paragraphs[0]
            p.text = cell
            p.font.size = Pt(11)

            if col_idx == 1:  # CorrectMe column
                p.font.color.rgb = GREEN
                p.font.bold = True
            elif "✗" in cell:
                p.font.color.rgb = RED
            elif "Parcial" in cell or "Limitado" in cell:
                p.font.color.rgb = YELLOW
            else:
                p.font.color.rgb = GRAY

            p.alignment = PP_ALIGN.CENTER if col_idx > 0 else PP_ALIGN.LEFT
            x += col_widths[col_idx]

def add_target_audience_slide(prs):
    """Slide: Público Alvo"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(9), Inches(0.8))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Ideal Para"
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    audiences = [
        ("Estudantes", "Preparando para provas Goethe, TestDaF, DSH"),
        ("Profissionais", "Que precisam escrever em alemão no trabalho"),
        ("Professores", "Que querem otimizar correções de alunos"),
        ("Aprendizes", "De qualquer nível, do A1 ao C2"),
    ]

    card_width = Inches(4.2)
    card_height = Inches(1.2)

    positions = [
        (Inches(0.5), Inches(1.5)),
        (Inches(5.3), Inches(1.5)),
        (Inches(0.5), Inches(3)),
        (Inches(5.3), Inches(3)),
    ]

    colors = [PINK, PURPLE, BLUE, GREEN]

    for i, ((title, desc), (x, y)) in enumerate(zip(audiences, positions)):
        # Card
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, card_width, card_height)
        card.fill.solid()
        card.fill.fore_color.rgb = DARK_700
        card.line.color.rgb = colors[i]
        card.line.width = Pt(2)

        # Título
        title_box = slide.shapes.add_textbox(x + Inches(0.2), y + Inches(0.15), card_width - Inches(0.4), Inches(0.4))
        tf = title_box.text_frame
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = colors[i]

        # Descrição
        desc_box = slide.shapes.add_textbox(x + Inches(0.2), y + Inches(0.55), card_width - Inches(0.4), Inches(0.6))
        tf = desc_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = desc
        p.font.size = Pt(13)
        p.font.color.rgb = GRAY

def add_cta_slide(prs):
    """Slide Final: Call to Action"""
    slide_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(slide_layout)

    # Background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = DARK_BG
    bg.line.fill.background()

    # Logo
    logo_path = os.path.join(IMAGES_DIR, "LogobrancofundoTransparentev1.png")
    if os.path.exists(logo_path):
        slide.shapes.add_picture(logo_path, Inches(3.5), Inches(0.8), height=Inches(1.2))

    # Título
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(2.3), Inches(9), Inches(1))
    tf = title_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Comece a dominar o alemão hoje!"
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    # Subtítulo
    subtitle_box = slide.shapes.add_textbox(Inches(0.5), Inches(3.3), Inches(9), Inches(0.6))
    tf = subtitle_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Experimente grátis - Créditos gratuitos para novos usuários"
    p.font.size = Pt(20)
    p.font.color.rgb = PURPLE
    p.alignment = PP_ALIGN.CENTER

    # URL
    url_box = slide.shapes.add_textbox(Inches(0.5), Inches(4.2), Inches(9), Inches(0.6))
    tf = url_box.text_frame
    p = tf.paragraphs[0]
    p.text = "correctme.com.br"
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = PINK
    p.alignment = PP_ALIGN.CENTER

def main():
    # Criar apresentação
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(5.625)  # 16:9

    # Slide 1: Título
    add_title_slide(prs)

    # Slide 2: Estatísticas
    add_stats_slide(prs)

    # Slide 3: Categorias de Erros
    add_categories_slide(prs)

    # Slide 4: Feature - Correção Inteligente
    add_feature_slide(
        prs,
        title="Feedback detalhado para cada erro",
        subtitle="Correção Inteligente",
        description="Nossa IA identifica erros de declinação, conjugação, sintaxe, preposições e vocabulário, destacando cada um com cores diferentes.",
        bullets=[
            "Correção gramatical e ortográfica em tempo real",
            "Feedback pedagógico que explica o 'porquê' de cada erro",
            "Suporte para todos os níveis (A1 a C2)",
            "IA treinada para erros comuns de brasileiros"
        ],
        image_name="Foto Dashboard.png",
        accent_color=PINK
    )

    # Slide 5: Feature - Dashboard
    add_feature_slide(
        prs,
        title="Visualize sua evolução em tempo real",
        subtitle="Acompanhe seu Progresso",
        description="Dashboard completo com gráficos e estatísticas detalhadas para acompanhar seu desenvolvimento.",
        bullets=[
            "Gráfico de pizza com distribuição de erros",
            "Histórico de erros por redação",
            "Estatísticas gerais de performance",
            "Tracking de evolução ao longo do tempo"
        ],
        image_name="Foto resultados.png",
        accent_color=PURPLE
    )

    # Slide 6: Feature - Vocabulário
    add_feature_slide(
        prs,
        title="Organize e pratique seu vocabulário",
        subtitle="Listas de Vocabulário",
        description="Crie listas personalizadas, importe palavras via CSV e classifique por nível de dificuldade.",
        bullets=[
            "Múltiplas listas organizadas por tema",
            "Importação de CSV",
            "Classificação por dificuldade (vermelho/amarelo/verde)",
            "Tradução automática para português"
        ],
        image_name="Lista de vocabulario.png",
        accent_color=GREEN
    )

    # Slide 7: Feature - Flashcards/Jogos
    add_feature_slide(
        prs,
        title="Pratique de forma interativa",
        subtitle="Jogos e Flashcards",
        description="Teste seu conhecimento com flashcards interativos e jogos divertidos como o jogo da forca.",
        bullets=[
            "Flashcards automáticos a partir das redações",
            "Jogo da forca com dicas inteligentes",
            "Filtro por nível de dificuldade",
            "Prática de artigos (der/die/das)"
        ],
        image_name="Jogos.png",
        accent_color=BLUE
    )

    # Slide 8: Como funciona
    add_how_it_works_slide(prs)

    # Slide 9: Comparação
    add_comparison_slide(prs)

    # Slide 10: Público Alvo
    add_target_audience_slide(prs)

    # Slide 11: CTA
    add_cta_slide(prs)

    # Salvar
    output_path = os.path.join(BASE_DIR, "CorrectMe_Apresentacao.pptx")
    prs.save(output_path)
    print(f"Apresentação salva em: {output_path}")
    return output_path

if __name__ == "__main__":
    main()
