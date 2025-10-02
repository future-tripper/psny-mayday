# PSNY MAYDAY - Fractal Poetry Ecosystem

A collaborative poetry platform for the Poetry Society of New York (PSNY) where poets create an infinite, self-perpetuating Crown of Sonnets.

## 🌱 The Fractal System

1. **Users sign up** → Get paired → Receive 2 bookend lines from a seed sonnet
2. **Pairs write** → Create 12 lines between bookends → Complete 14-line sonnet
3. **Sonnets spawn** → Each completed sonnet becomes a seed for future Crowns
4. **Crowns complete** → New Crowns auto-create from next available seed
5. **Pattern repeats infinitely** → Fractal tree of poetry grows organically

## 🎨 Visualization

Visit `/crown/{id}/visualize` to explore three integrated views:

- **JEWELS**: 3D orbital view with breathing orbs (Three.js)
- **THREADS**: Timeline of lineage
- **SCROLL**: Vertical list of all sonnets

## 🚀 Quick Start

```bash
# Setup
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install fastapi uvicorn sqlmodel jinja2 python-multipart

# Seed database
python seed.py

# Run server
uvicorn app:app --reload
# Visit http://localhost:8000
```

## 📚 Documentation

See `claude.md` for full technical documentation and deployment guide.

## 🎭 Vision

See `VISION_BOARD.md` for future feature ideas and expansion concepts.
