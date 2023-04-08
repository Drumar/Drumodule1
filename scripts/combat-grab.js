if ( canvas.tokens.controlled.length !== 1 ) { return ui.notifications.info("Please select 1 token") }
if ( game.user.targets.size !== 1 ) { return ui.notifications.info("Please select 1 target for Combat Grab") }

/* check if the user has Combat Grab */
if ( !token.actor.itemTypes.action.some( f => f.slug === "combat-grab") 
	&& !token.actor.itemTypes.feat.some(f => f.slug === "combat-grab")
) {
	return ui.notifications.warn(`${token.name} does not have Combat Grab!`); 
}

const DamageRoll = CONFIG.Dice.rolls.find( r => r.name === "DamageRoll" );
const critRule = game.settings.get("pf2e", "critRule");

let weapons = token.actor.system.actions.filter( h => h.visible && h.item?.system?.traits?.value?.includes("unarmed"));

let wtcf = '';
for ( const w of weapons ) {
    wtcf += `<option value=${w.item.id}>${w.item.name}</option>`
}

const { cWeapon, map, bypass, dos} = await Dialog.wait({
    title: "Combat Grab",
    content: `
    <select id="cgm" autofocus>
        ${wtcf}
    </select><hr>
        <select id="map">
        <!--option value=0>No MAP (not valid due to press trait)</option-->
        <option value=1>MAP 1</option>
        <option value=2>MAP 2</option>
    </select><hr>
`,
    buttons:{
        ok: {
            label: "Combat Grab",
            icon:"<i class='fa-solid fa-hand-fist'></i>",
            callback: (html) => {
                return { cWeapon: [html[0].querySelector("#cgm").value], map: parseInt(html[0].querySelector("#map").value), bypass: false } 
            }
        },
        bypass: {
            label:"Bypass",
            icon: "<i class='fa-solid fa-forward'></i>",
            callback: async (html) => {
                const cWeapon = [html[0].querySelector("#cgm").value];
                const map = parseInt(html[0].querySelector("#map").value);
                const dos = await Dialog.wait({
                    title:"Degree of Success",
                    content: `
                        <table>
                            <tr>
                                <td>${weapons.find( w => w.item.id === cWeapon[0] ).label}</td>
                                <td><select id="dos" autofocus>
                                <option value=2>Success</option>
                                <option value=3>Critical Success</option>
                                <option value=1>Failure</option>
                                <option value=0>Critical Failure</option>
                                </select></td>
                            </tr>
                        </table>
                        `,
                    buttons: {
                        ok: {
                            label: "Reroll",
                            icon: "<i class='fa-solid fa-dice'></i>",
                            callback: (html) => { return [parseInt(html[0].querySelector("#dos").value) ] }
                        },
                        cancel: {
                            label: "Cancel",
                            icon: "<i class='fa-solid fa-ban'></i>",
                        }
                    },
                    default: 'ok'
                },{width:"auto"});
                return { cWeapon, map, bypass: true, dos }
            },
        },
        cancel: {
            label: "Cancel",
            icon: "<i class='fa-solid fa-ban'></i>",
        }
    },
    default: "ok"
}, {width: "auto"});

if ( cWeapon === undefined ) { return; }

const primary = weapons.find( w => w.item.id === cWeapon[0] );

const cM = [];
function PD(cm) {
    if ( cm.user.id === game.userId && cm.isDamageRoll ) {
        if ( !cM.map(f => f.flavor).includes(cm.flavor) ) {
            cM.push(cm);
        }
        return false;
    }
}

Hooks.on('preCreateChatMessage', PD);

const pdos = bypass ? dos[0] : (await primary.variants[map].roll({skipDialog:true, event })).degreeOfSuccess;
/* options would be something like stunning fist, but that only applies on FoB */
let options=[];
let pd;
if ( pdos === 2 ) { pd = await primary.damage({event,options}); }
if ( pdos === 3 ) { pd = await primary.critical({event,options}); }

Hooks.off('preCreateChatMessage', PD);
await new Promise( (resolve) => {
    setTimeout(resolve,0);
});

if ( pdos <=0 ) { return }
else {
    const escapeDC=token.actor.skills['athletics'].dc.value;
    const terms = pd.terms[0].terms;
    const type = pd.terms[0].rolls.map(t => t.type);
    const persistent = pd.terms[0].rolls.map(t => t.persistent);

    let preCombinedDamage = [];
    let combinedDamage = '{';
    let i = 0;

    for ( const t of terms ) {
        if ( persistent[i] && !preCombinedDamage.find( p => p.persistent && p.terms.includes(t) ) ) {
            preCombinedDamage.push({ terms: [t], type: type[i], persistent: persistent[i] });
        }
        if ( !preCombinedDamage.some(pre => pre.type === type[i]) && !persistent[i] ) {
            preCombinedDamage.push({ terms: [terms[i]], type: type[i], persistent: persistent[i] });
        }
        else if ( !persistent[i] ) {
            preCombinedDamage.find( pre => pre.type === type[i] ).terms.push(t);
        }
        i++;
    }
    for ( p of preCombinedDamage ) {    
        if ( p.persistent ) {
        combinedDamage += `, ${p.terms.join(",")}`;
        }
        else{
            if ( combinedDamage === "{" ) {
                if ( p.terms.length > 1 ){
                    combinedDamage += `(${p.terms.join(" + ")})[${p.type}]`;
                
                }
                else {
                    combinedDamage += p.terms[0];
                }
            }
            else if ( p.terms.length === 1 ) {
                combinedDamage += `, ${p.terms[0]}`;
            }
            else {
                combinedDamage += `, (${p.terms.join(" + ")})[${p.type}]`;
            }
        }
    }
    combinedDamage += "}";

    const rolls = [await new DamageRoll(combinedDamage).evaluate({ async: true })]
    let flavor = `<strong>Combat Grab Damage</strong>`;
    const color = (pdos ) === 2 ? `<span style="color:rgb(0, 0, 255)">Success</span>` : `<span style="color:rgb(0, 128, 0)">Critical Success</span>`

    flavor += ` if the Strike hits, you grab the target using your free hand. The creature remains @UUID[Compendium.pf2e.conditionitems.kWc1fhmv9LBiTuei]{Grabbed} 
    until the end of your next turn or until it succeeds at <span data-pf2-action="escape" data-pf2-glyph="A" data-pf2-dc="`+escapeDC+`">Best of Unarmed, Acrobatics, or Athletics</span> to @UUID[Compendium.pf2e.actionspf2e.SkZAQRkLLkmBQNB9]{Escape}, whichever comes first.`;
    if ( pdos === 3) {
        flavor += `<hr><strong>TOP DAMAGE USED FOR CREATURES IMMUNE TO CRITICALS`;
        
        if ( critRule === "doubledamage" ) {
            rolls.unshift(await new DamageRoll(combinedDamage.replaceAll("2 * ", "")).evaluate({ async: true }));
        }
        else if ( critRule === "doubledice" ) {
            const splitValues = combinedDamage.replaceAll("2 * ", "").replaceAll(/([\{\}])/g,"").split(" ");
            const toJoinVAlues = [];
            for ( const sv of splitValues ) {
                if ( sv.includes("[doubled])") ) {
                    const sV = sv.replaceAll("[doubled])","");
                    if ( !sV.includes("d") ) {
                            toJoinVAlues.push("sV");
                            continue;
                    }
                    else {
                        const n = sV.split(/(d\d)/g);
                        if ( n[0].charAt(1) !== "(") {
                            n[0] = `${parseInt(n[0].charAt(1) / 2)}`;
                            toJoinVAlues.push(n.join(""));
                            continue;
                        }
                        else if ( n[0].charAt(2) !== "(") { 
                            n[0] = `(${parseInt(n[0].charAt(2)) / 2}`;
                            toJoinVAlues.push(n.join(""));
                            continue;
                        }
                        else { 
                            n[0] = `((${parseInt(n[0].charAt(3)) / 2}`;
                            toJoinVAlues.push(n.join(""));
                            continue;
                        }
                    }
                }
                else {
                    toJoinVAlues.push(sv);
                    continue;
                }
            }
            rolls.unshift(await new DamageRoll(`{${toJoinVAlues.join(" ")}}`).evaluate( {async: true} ));
        }
    }
    if ( cM.length === 1) {
        options = cM[0].flags.pf2e.context.options;
    }
    else { options = [...new Set(cM[0].flags.pf2e.context.options.concat(cM[1].flags.pf2e.context.options))]; }
    await ChatMessage.create({
        flags: { 
            pf2e: {
                context: {
                    options
                }
            }
        },
        rolls,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        flavor,
        speaker: ChatMessage.getSpeaker(),
    });
}
