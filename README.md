# Formona

Formona is a cross-platform beauty device app MVP for real-time eyebrow
analysis, face-shape classification, personalized eyebrow recommendations, and
AR eyebrow overlay visualization.

This repository is being prepared for implementation based on
[spec.md](spec.md). The current step is repository setup and GitHub remote
integration only.

## MVP Goal

The MVP helps a user scan their face, classify their face shape, choose a
recommended eyebrow style, and preview the recommended eyebrow outline as a
real-time AR overlay with millimeter-based measurements.

## Planned Flow

1. Splash screen
2. IPD input
3. Camera permission request
4. Live front-camera face alignment
5. Face-shape classification
6. Eyebrow style recommendation
7. AR eyebrow overlay with measurement output

## MVP Scope

- Front camera preview
- Face alignment guide overlay
- MediaPipe FaceMesh based landmark extraction
- Rule-based classification for oval, square, round, and heart face shapes
- Three eyebrow style recommendations per face shape
- IPD-based pixel-to-millimeter conversion
- Eyebrow measurement output
- Real-time eyebrow outline overlay

## Out of Scope for MVP

- Account, login, and history features
- Payment or commerce features
- Skin analysis
- Eyebrow color simulation
- Automatic stencil generation or production device integration

## Current Status

- GitHub remote: `https://github.com/formona/formona.git`
- Source specification: [spec.md](spec.md)
- Implementation: not started in this setup step

## Open Decisions

- Cross-platform framework
- Face-shape threshold tuning strategy
- Implementation schedule
- Maintenance scope
