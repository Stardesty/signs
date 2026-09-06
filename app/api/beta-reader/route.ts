import { NextRequest, NextResponse } from 'next/server';
import { fullAnalysis } from '@/lib/analysis';
import { runAI, stripUncited } from '@/lib/ai';
import { computeChart } from '@/lib/astro';
import { computeSynastry } from '@/lib/synastry';
import type { Project } from '@/lib/types';
import { wordCount } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/beta-reader
 * body: { project, bookId?, focus?: 'overall'|'scene', sceneId? }
 *
 * The deterministic engine assembles evidence; the LLM (if configured) turns
 * it into an editorial letter. Without a key you still get the letter, built
 * from the same evidence by template.
 */
export async function POST(req: NextRequest) {
  try {
    const { project, bookId, sceneId } = (await req.json()) as
      { project: Project; bookId?: string; sceneId?: string };
    if (!project) return NextResponse.json({ error: 'project required' }, { status: 400 });

    const report = fullAnalysis(project, bookId);
    const scenes = bookId ? project.scenes.filter((s) => s.bookId === bookId) : project.scenes;
    const focusScene = sceneId ? project.scenes.find((s) => s.id === sceneId) : null;

    // ---- evidence bundle (the only thing the model may reason over) -------
    const validIds: string[] = [
      ...project.scenes.map((s) => s.id),
      ...project.characters.map((c) => c.id),
      ...project.world.map((w) => w.id),
      ...project.beats.map((b) => b.id),
    ];

    const castLines = project.characters.map((c) => {
      const chart = c.birth ? computeChart(c.id, c.birth) : null;
      const big = chart
        ? `${chart.placements.find((p) => p.body === 'Sun')!.sign} Sun / ${chart.placements.find((p) => p.body === 'Moon')!.sign} Moon`
        : 'no chart';
      return `- [${c.id}] ${c.name} (${c.role}, ${big}). Want: ${c.psychology.want}. Need: ${c.psychology.need}. Lie: ${c.psychology.lie}. Arc: ${c.psychology.arcType}.`;
    }).join('\n');

    const sceneLines = scenes.map((s) =>
      `- [${s.id}] "${s.title}" | ${s.status} | ${wordCount(s.content)}w | tension ${s.tensionLevel}/10 | valence ${s.emotionalValence} | POV ${project.characters.find((c) => c.id === s.povCharacterId)?.name ?? 'none'} | ${s.synopsis}`,
    ).join('\n');

    const findingLines = report.findings.slice(0, 30).map((x) =>
      `- (${x.severity}/${x.module}) ${x.title} :: ${x.detail} :: FIX: ${x.suggestion}`,
    ).join('\n');

    const pairs: string[] = [];
    const charted = project.characters.filter((c) => c.birth);
    for (let i = 0; i < charted.length; i++) {
      for (let j = i + 1; j < charted.length; j++) {
        const r = computeSynastry(
          computeChart(charted[i].id, charted[i].birth!),
          computeChart(charted[j].id, charted[j].birth!),
          charted[i].name, charted[j].name);
        pairs.push(`- ${charted[i].name} [${charted[i].id}] ↔ ${charted[j].name} [${charted[j].id}]: ${r.headline}; tension ${r.scores.tension}%, harmony ${r.scores.harmony}%, power skew ${r.scores.powerImbalance}. Top contact: ${r.aspects[0] ? `${r.aspects[0].a} ${r.aspects[0].aspect} ${r.aspects[0].b}` : 'none'}.`);
      }
    }

    const context = [
      `SERIES: ${project.series.title} — ${project.series.premise}`,
      `THEMES: ${project.series.themes.join('; ')}`,
      '', 'CAST:', castLines,
      '', 'SCENES:', sceneLines,
      '', 'RELATIONAL ASTROLOGY (Synastry Engine output):', pairs.join('\n'),
      '', `PACING: ${report.pacing.points.length} scenes, ${report.pacing.totalWords} words, avg ${report.pacing.averageSceneLength}w, tension variance ${report.pacing.tensionVariance}, POV balance ${report.pacing.povBalance}.`,
      '', 'ENGINE FINDINGS (already verified — do not contradict these):', findingLines,
      focusScene ? `\nFOCUS SCENE [${focusScene.id}] "${focusScene.title}":\n${focusScene.content.slice(0, 4000)}` : '',
    ].join('\n');

    const prompt = `${context}\n\n---\nWrite an editorial letter to the author${focusScene ? ` focused on the scene "${focusScene.title}"` : ' covering the whole manuscript so far'}. Structure it as:\n1. What is working (2-3 sentences, specific, cite ids).\n2. The single biggest structural problem, named plainly.\n3. Three concrete revisions, each tied to a scene id.\n4. One observation the author probably has not noticed.\nMaximum 450 words. Cite ids in brackets.`;

    // ---- deterministic fallback letter -----------------------------------
    const crit = report.findings.filter((x) => x.severity === 'critical');
    const warn = report.findings.filter((x) => x.severity === 'warning');
    const strongest = [...scenes].sort((a, b) => b.tensionLevel - a.tensionLevel)[0];
    const weakest = [...scenes].sort((a, b) =>
      (a.tensionLevel + (a.diagnostics.changesPlotState ? 3 : 0)) -
      (b.tensionLevel + (b.diagnostics.changesPlotState ? 3 : 0)))[0];

    const fallback = [
      `**Manuscript health: ${report.health}/100** — ${crit.length} critical, ${warn.length} warnings, ${report.findings.length - crit.length - warn.length} notes across ${scenes.length} scenes and ${report.pacing.totalWords} words.`,
      '',
      `**What is working.** "${strongest?.title}" [${strongest?.id}] carries the highest tension in the book (${strongest?.tensionLevel}/10) and is doing real structural work — it changes the plot state and reveals character in the same movement. The cast is unusually well differentiated: ${project.characters.map((c) => `${c.name} wants ${c.psychology.want.toLowerCase().replace(/\.$/, '')}`).slice(0, 3).join(', ')}. Those wants collide rather than run parallel, which is why the ensemble scenes hold.`,
      '',
      `**Biggest structural problem.** ${crit[0] ? `${crit[0].title}. ${crit[0].detail}` : warn[0] ? `${warn[0].title}. ${warn[0].detail}` : `Pacing variance sits at ${report.pacing.tensionVariance}; the manuscript is running at a fairly constant pitch. Readers habituate.`}`,
      '',
      '**Three revisions:**',
      ...report.findings.slice(0, 3).map((x, i) =>
        `${i + 1}. ${x.title} — ${x.suggestion} ${x.evidence.map((e) => `[${e.sceneId ?? e.entityId}]`).join(' ')}`),
      '',
      `**What you may not have noticed.** ${pairs.length ? `The Synastry Engine reads ${pairs.length} pairings in this cast. ${(() => {
        const unused = report.findings.find((x) => x.module === 'synastry');
        return unused ? `${unused.title}: ${unused.detail}` : `The strongest relational charge in the book is not the one you are writing most.`;
      })()}` : 'Add birth data to your cast to unlock relational analysis.'} ${weakest ? `Separately: "${weakest.title}" [${weakest.id}] is the scene most at risk of being cut by an editor — it is your lowest-pressure page and it does not move the plot state.` : ''}`,
    ].join('\n');

    const ai = await runAI(prompt, fallback);
    return NextResponse.json({
      ...ai,
      text: ai.mode === 'llm' ? stripUncited(ai.text, validIds) : ai.text,
      health: report.health,
      findingCount: report.findings.length,
      evidenceIds: validIds.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
