import fs from 'fs';

export function removeUntranslatables(field: any, name?: string, parent?: any, parentName?: string): any {
  if (field instanceof Array) {
    const fieldParent = JSON.parse(JSON.stringify(field));
    for (let i = field.length; i >= 0; i--) {
      field[i] = removeUntranslatables(field[i], undefined, fieldParent, name);
      if (field[i] === undefined) field.splice(i, 1);
    }
    if (field.length === 0) field = undefined;
  } else if (typeof field === 'object') {
    const fieldParent = JSON.parse(JSON.stringify(field));
    for (const property in field) {
      field[property] = removeUntranslatables(field[property], property, fieldParent, name);
      if (field[property] === undefined) delete field[property];
    }
    if (field !== null && parentName !== 'fields' && Object.keys(field).length === 0) {
      field = undefined;
    }
    const hasOnlyFields = field?.fields && Array.isArray(field.fields);
    if (hasOnlyFields && field.fields.every((sub: any) => typeof sub === 'object' && Object.keys(sub).length === 0)) {
      if (Object.keys(field).length !== 1) delete field.fields;
      else field = undefined;
    }
    if (field?.options && field.default) delete field.default;
  } else if (name === undefined || itemUntranslatable(name, field, parent)) {
    field = undefined;
  }
  if (field === null) field = undefined;
  return field;
}

const languageCodes: string[] = ["aa","ab","ae","af","ak","am","an","ar","as","av","ay","az","ba","be","bg","bh","bi","bm","bn","bo","br","bs","ca","ce","ch","co","cr","cs","cu","cv","cy","da","de","dv","dz","ee","el","en","eo","es","et","eu","fa","ff","fi","fj","fo","fr","fy","ga","gd","gl","gn","gu","gv","ha","he","hi","ho","hr","ht","hu","hy","hz","ia","id","ie","ig","ii","ik","io","is","it","iu","ja","jv","ka","kg","ki","kj","kk","kl","km","kn","ko","kr","ks","ku","kv","kw","ky","la","lb","lg","li","ln","lo","lt","lu","lv","mg","mh","mi","mk","ml","mn","mr","ms","mt","my","na","nb","nd","ne","ng","nl","nn","no","nr","nv","ny","oc","oj","om","os","pa","pi","pl","ps","pt","qu","rm","rn","ro","ru","rw","sa","sc","sd","se","sg","si","sk","sl","sm","sn","so","sq","sr","ss","st","su","sv","sw","ta","te","tg","th","ti","tk","tl","tn","to","tr","ts","tt","tw","ty","ug","uk","ur","uz","ve","vi","vo","wa","wo","xh","yi","yo","za","zh","zu","es-mx","pt-br","sma","sme","smj","zh-cn","zh-hans","zh-tw"];

export function itemUntranslatable(property: string, value: any, _parent: any): boolean {
  switch (property) {
    case 'label': case 'entity': case 'explanation': case 'example':
      return false;
    case 'description': case 'placeholder':
      return String(value).trim().length === 0;
    case 'default':
      if (typeof value !== 'string') return true;
      if (value.trim().length === 0) return true;
      if (!isNaN(Number(value))) return true;
      if (!value.replaceAll(/<\/?[a-z][^>]*>/ig, '')) return true;
      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) return true;
      if (/^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/.test(value)) return true;
      if (/^rgb(a)?(\()?[\d\s,.\/%]+(\))?$/.test(value)) return true;
      if (/^hsl(a)?(\()?[\d\s,.\/%]+(\))?$/.test(value)) return true;
      if (/^hsv?(\()?[\d\s,.\/%]+(\))?$/.test(value)) return true;
      if (/^hwb\([\w\d\s,.\/%]+\)$/.test(value)) return true;
      if (languageCodes.includes(value)) return true;
      return false;
    default:
      return true;
  }
}

export function createDefaultLanguage(libraryDir: string): any {
  const file = `${libraryDir}/semantics.json`;
  if (!fs.existsSync(file)) return {};
  try {
    const semantics = JSON.parse(fs.readFileSync(file).toString());
    return removeUntranslatables(semantics);
  } catch {
    return {};
  }
}
