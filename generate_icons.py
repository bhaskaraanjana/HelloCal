import os
import sys

# Ensure Pillow is installed
try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    print("Pillow is not installed. Installing it now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFilter

def create_icon(size):
    # 1. Create a deep obsidian background matching the Obsidian glassmorphism palette (#0a0b10)
    img = Image.new("RGBA", (size, size), (10, 11, 16, 255)) 
    draw = ImageDraw.Draw(img)
    center = size // 2
    
    # 2. Draw a beautiful glowing violet radial backing glow
    glow_size = int(size * 0.75)
    glow = Image.new("RGBA", (glow_size, glow_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        [0, 0, glow_size - 1, glow_size - 1],
        fill=(139, 92, 246, 50)  # Violet #8b5cf6 with low opacity
    )
    # Apply a smooth high Gaussian blur to create a rich neon atmospheric glow
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    img.paste(glow, (center - glow_size // 2, center - glow_size // 2), glow)
    
    # 3. Draw a glowing golden-amber circular Halo Ring
    ring_radius = int(size * 0.32)
    ring_width = max(2, int(size * 0.045))
    
    # Draw outer ring with amber yellow (#f59e0b)
    draw.ellipse(
        [center - ring_radius, center - ring_radius, center + ring_radius, center + ring_radius],
        outline=(245, 158, 11, 255),
        width=ring_width
    )
    
    # 4. Draw a sharp futuristic violet-neon core lightning bolt
    bolt = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bolt_draw = ImageDraw.Draw(bolt)
    
    # Scale precise vertex coordinates for the lightning bolt
    p1 = (center + int(size * 0.05), center - int(size * 0.18))
    p2 = (center - int(size * 0.12), center + int(size * 0.02))
    p3 = (center - int(size * 0.01), center + int(size * 0.02))
    p4 = (center - int(size * 0.05), center + int(size * 0.18))
    p5 = (center + int(size * 0.12), center - int(size * 0.02))
    p6 = (center + int(size * 0.01), center - int(size * 0.02))
    
    bolt_draw.polygon([p1, p2, p3, p4, p5, p6], fill=(168, 85, 247, 255)) # Glowing light purple #a855f7
    
    # Blur the core slightly to create a high-fidelity neon glow, paste it, then paste the sharp core on top
    bolt_glow = bolt.filter(ImageFilter.GaussianBlur(size * 0.025))
    img.paste(bolt_glow, (0, 0), bolt_glow)
    img.paste(bolt, (0, 0), bolt)
    
    # 5. Draw micro-details: a tiny glowing gold star/sparkle at the top right of the halo
    sparkle_center = (center + int(ring_radius * 0.707), center - int(ring_radius * 0.707))
    sparkle_size = max(4, int(size * 0.035))
    draw.ellipse(
        [sparkle_center[0] - sparkle_size, sparkle_center[1] - sparkle_size,
         sparkle_center[0] + sparkle_size, sparkle_center[1] + sparkle_size],
        fill=(255, 255, 255, 255)
    )
    
    return img

if __name__ == "__main__":
    os.makedirs("public", exist_ok=True)
    
    print("Generating PWA assets...")
    create_icon(192).save("public/icon-192.png", "PNG")
    create_icon(512).save("public/icon-512.png", "PNG")
    create_icon(180).save("public/apple-touch-icon.png", "PNG")
    
    print("Successfully generated all high-fidelity brand PWA icons: icon-192.png, icon-512.png, apple-touch-icon.png!")
