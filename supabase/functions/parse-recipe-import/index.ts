import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse as parseYaml } from 'https://deno.land/x/js_yaml_port@3.14.0/js-yaml.js';

const INGREDIENT_RE = /^-\s+(?:(\d+(?:\.\d+)?)\s+([\w/]+)\s+)?(.+?)(?:,\s*(.+))?$/;
const STEP_TIME_RE = /\((\d+)\s*min\)/i;
const STEP_GROUP_RE = /\[group:(\d+)\]/i;

function parseMarkdown(text: string): object {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) throw new Error('Missing YAML front-matter');

  const meta = parseYaml(fmMatch[1]) as Record<string, any>;
  const body = fmMatch[2];

  const ingredientHeading = /^##\s+(Ingredientes|Ingredients)\s*$/im;
  const stepHeading = /^##\s+(Pasos|Steps)\s*$/im;

  const ingMatch = ingredientHeading.exec(body);
  const stepMatch = stepHeading.exec(body);
  if (!ingMatch || !stepMatch) throw new Error('Missing ## Ingredientes/Ingredients or ## Pasos/Steps heading');

  const ingStart = ingMatch.index! + ingMatch[0].length;
  const stepStart = stepMatch.index! + stepMatch[0].length;
  const ingBlock = body.slice(ingStart, stepMatch.index).trim();
  const stepBlock = body.slice(stepStart).trim();

  const firstHeading = Math.min(ingMatch.index!, stepMatch.index!);
  const description = body.slice(0, firstHeading).trim() || undefined;

  const ingredients = ingBlock.split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(line => {
      const m = INGREDIENT_RE.exec(line.trim());
      if (!m) return null;
      const [, qty, unit, name, prep] = m;
      return {
        name: name.trim(),
        ...(qty ? { qty: parseFloat(qty) } : {}),
        ...(unit ? { unit } : {}),
        ...(prep ? { prep: prep.trim() } : {}),
      };
    })
    .filter(Boolean);

  const steps = stepBlock.split('\n')
    .filter(l => /^\d+\./.test(l.trim()))
    .map(line => {
      const orderMatch = /^(\d+)\./.exec(line.trim());
      const order = orderMatch ? parseInt(orderMatch[1]) : 0;
      let text = line.trim().replace(/^\d+\.\s*/, '');

      const timeM = STEP_TIME_RE.exec(text);
      const groupM = STEP_GROUP_RE.exec(text);
      const time = timeM ? parseInt(timeM[1]) : undefined;
      const concurrent_group = groupM ? parseInt(groupM[1]) : undefined;

      text = text.replace(STEP_TIME_RE, '').replace(STEP_GROUP_RE, '').trim();
      return { order, text, ...(time ? { time } : {}), ...(concurrent_group ? { concurrent_group } : {}) };
    });

  return { ...meta, description, ingredients, steps };
}

function parseJson(text: string): object | object[] {
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  const payload = await req.json();
  const { record } = payload;
  if (!record) return new Response('no record', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  await supabase.from('import_jobs').update({ status: 'processing' }).eq('id', record.id);

  try {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('recipe-imports')
      .download(record.file_path);
    if (dlError) throw new Error(dlError.message);

    const text = await fileData.text();
    const isJson = record.file_path.endsWith('.json');
    const parsed = isJson ? parseJson(text) : parseMarkdown(text);
    const recipes = Array.isArray(parsed) ? parsed : [parsed];

    for (const recipe of recipes) {
      if (!recipe.name || !recipe.steps) throw new Error('Recipe missing name or steps');
      await supabase.from('recipes').insert({
        ...recipe,
        user_id: record.user_id,
        source_file: record.file_path,
      });
    }

    await supabase.from('import_jobs').update({ status: 'done' }).eq('id', record.id);
  } catch (e: any) {
    await supabase.from('import_jobs')
      .update({ status: 'error', error_msg: e.message })
      .eq('id', record.id);
  }

  return new Response('ok');
});
