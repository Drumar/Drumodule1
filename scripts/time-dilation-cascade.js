if ( canvas.tokens.controlled.length !== 1 ) { return ui.notifications.info("Please select 1 token") }
if ( game.user.targets.size !== 1 ) { return ui.notifications.info("Please select 1 target for Time Dilation Cascade") }

if ( !token.actor.itemTypes.action.some(f => f.slug === "time-dilation-cascade")
    && !token.actor.itemTypes.feat.some(f => f.slug === "time-dilation-cascade") ) {
    return ui.notifications.warn(`${token.name} does not have Time Dilation Cascade!`);
}

const DamageRoll = CONFIG.Dice.rolls.find( r => r.name === "DamageRoll" );
const critRule = game.settings.get("pf2e", "critRule");

/* requires a ranged weapon with reload 0 */
let weapons = token.actor.system.actions.filter(h=>h.visible && h.item.system.range > 0 && h.item.system.reload.value == 0)
let wtcf = '';
for ( const w of weapons ) {
    wtcf += `<option value=${w.item.id}>${w.item.name}</option>`
}

const { cWeapon, map, bypass, dos} = await Dialog.wait({
    title:"Time Dilation Cascade",
    content: `
        <select id="tdc1" autofocus>
            ${wtcf}
        </select><hr>
        <select id="map">
            <option value=0>No MAP</option>
            <option value=1>MAP 1</option>
            <option value=2>MAP 2</option>
        </select><hr>
    `,
    buttons: {
            ok: {
                label: "Time Dilation Cascade",
                icon: "<i class='fa-solid fa-bow'></i>",
                callback: (html) => { return { cWeapon: [html[0].querySelector("#tdc1").value,html[0].querySelector("#tdc1").value], map: parseInt(html[0].querySelector("#map").value), bypass: false } }
            },
            bypass: {
                label:"Bypass",
                icon: "<i class='fa-solid fa-forward'></i>",
                callback: async (html) => {
                    const cWeapon = [html[0].querySelector("#tdc1").value,html[0].querySelector("#tdc1").value];
                    const map = parseInt(html[0].querySelector("#map").value);
                    const dos = await Dialog.wait({
                        title:"Degree of Success",
                        content: `
                            <table>
                                <tr>
                                    <td>${weapons.find( w => w.item.id === cWeapon[0] ).label} (1st)</td>
                                    <td><select id="dos1" autofocus>
                                    <option value=2>Success</option>
                                    <option value=3>Critical Success</option>
                                    <option value=1>Failure</option>
                                    <option value=0>Critical Failure</option>
                                    </select></td>
                                </tr>
                                <tr>
                                    <td>${weapons.find( w => w.item.id === cWeapon[0] ).label} (2nd)</td>
                                    <td><select id="dos2">
                                        <option value=2>Success</option>
                                        <option value=3>Critical Success</option>
                                        <option value=1>Failure</option>
                                        <option value=0>Critical Failure</option>
                                    </select></td>
                                </tr>
                                <tr>
                                    <td>${weapons.find( w => w.item.id === cWeapon[0] ).label} (3rd)</td>
                                    <td><select id="dos3">
                                        <option value=2>Success</option>
                                        <option value=3>Critical Success</option>
                                        <option value=1>Failure</option>
                                        <option value=0>Critical Failure</option>
                                    </select></td>
                                </tr>
                                <tr>
                                    <td>${weapons.find( w => w.item.id === cWeapon[0] ).label} (4th)</td>
                                    <td><select id="dos4">
                                        <option value=2>Success</option>
                                        <option value=3>Critical Success</option>
                                        <option value=1>Failure</option>
                                        <option value=0>Critical Failure</option>
                                    </select></td>
                                </tr>
                                <tr>
                                    <td>${weapons.find( w => w.item.id === cWeapon[0] ).label} (5th)</td>
                                    <td><select id="dos5">
                                        <option value=2>Success</option>
                                        <option value=3>Critical Success</option>
                                        <option value=1>Failure</option>
                                        <option value=0>Critical Failure</option>
                                    </select></td>
                                </tr>
                                <tr>
                                    <td>${weapons.find( w => w.item.id === cWeapon[0] ).label} (6th)</td>
                                    <td><select id="dos6">
                                        <option value=2>Success</option>
                                        <option value=3>Critical Success</option>
                                        <option value=1>Failure</option>
                                        <option value=0>Critical Failure</option>
                                    </select></td>
                                </tr>
                            </table><hr>
                        `,
                        buttons: {
                            ok: {
                                label: "Reroll",
                                icon: "<i class='fa-solid fa-dice'></i>",
                                callback: (html) => {
                                    return [
                                        parseInt(html[0].querySelector("#dos1").value),
                                        parseInt(html[0].querySelector("#dos2").value),
                                        parseInt(html[0].querySelector("#dos3").value),
                                        parseInt(html[0].querySelector("#dos4").value),
                                        parseInt(html[0].querySelector("#dos5").value),
                                        parseInt(html[0].querySelector("#dos6").value)
                                    ]
                                }
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
},{width:"auto"});

const map2 = map === 2 ? map : map + 1;
const map3 = map2 === 2 ? map2 : map2 + 1;
const map4 = 2; // 3rd shot and consecutive is always MAP 2
const map5 = 2;
const map6 = 2;

if ( cWeapon === undefined ) { return; }
const primary = weapons.find( w => w.item.id === cWeapon[0] );

//let options = token.actor.itemTypes.feat.some(s => s.slug === "stunning-fist") ? ["stunning-fist"] : [];
let options = [];

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

const dos1 = bypass ? dos[0] : (await primary.variants[map].roll({skipDialog:true, event })).degreeOfSuccess;
const dos2 = bypass ? dos[1] : (await primary.variants[map2].roll({skipDialog:true, event})).degreeOfSuccess;
const dos3 = bypass ? dos[2] : (await primary.variants[map3].roll({skipDialog:true, event})).degreeOfSuccess;
const dos4 = bypass ? dos[3] : (await primary.variants[map4].roll({skipDialog:true, event})).degreeOfSuccess;
const dos5 = bypass ? dos[4] : (await primary.variants[map5].roll({skipDialog:true, event})).degreeOfSuccess;
const dos6 = bypass ? dos[5] : (await primary.variants[map6].roll({skipDialog:true, event})).degreeOfSuccess;

const darray=[];
if ( dos1 === 2 ) {
    const result=await primary.damage({event,options});
    darray.push(result);
}
if ( dos1 === 3 ) {
    const result=await primary.critical({event,options});
    darray.push(result);
}
if ( dos2 === 2 ) {
    const result=await primary.damage({event,options});
    darray.push(result);
}
if ( dos2 === 3 ) {
    const result=await primary.critical({event,options});
    darray.push(result);
}
if ( dos3 === 2 ) {
    const result=await primary.damage({event,options});
    darray.push(result);
}
if ( dos3 === 3 ) {
    const result=await primary.critical({event,options});
    darray.push(result);
}
if ( dos4 === 2 ) {
    const result=await primary.damage({event,options});
    darray.push(result);
}
if ( dos4 === 3 ) {
    const result=await primary.critical({event,options});
    darray.push(result);
}
if ( dos5 === 2 ) {
    const result=await primary.damage({event,options});
    darray.push(result);
}
if ( dos5 === 3 ) {
    const result=await primary.critical({event,options});
    darray.push(result);
}
if ( dos6 === 2 ) {
    const result=await primary.damage({event,options});
    darray.push(result);
}
if ( dos6 === 3 ) {
    const result=await primary.critical({event,options});
    darray.push(result);
}

Hooks.off('preCreateChatMessage', PD);

await new Promise( (resolve) => {
    setTimeout(resolve,0);
});

if ( dos1 <=1 && dos2 <= 1 && dos3 <= 1 && dos4 <= 1 && dos5 <= 1 && dos6 <= 1 ) { return }
else {
    const type=[];
    const terms=[];
    const persistent=[];
    let counter=0;
    for( d of darray ) {
        for( dt of d.terms[0].terms){
            terms.push(dt);
        }

        for(tt of d.terms[0].rolls.map(t=>t.type)){
            type.push(tt);
        }

        for(dp of d.terms[0].rolls.map(t=>t.persistent)){
            persistent.push(dp);
        }
    }
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
    let flavor = `<strong>Time Dilation Cascade Total Damage</strong>`;
    const color = (dos1 || dos2 || dos3 || dos4 || dos5 || dos6) === 2 ? `<span style="color:rgb(0, 0, 255)">Success</span>` : `<span style="color:rgb(0, 128, 0)">Critical Success</span>`
    if ( cM.length === 0 ) {
        flavor += `<p>(${color})<hr></p><hr>`;
    } else if ( cM.length === 1 ) {
        flavor += `<p>Same Weapon (${color})<hr>${cM[0].flavor}</p><hr>`;
    }else {
        flavor += `<hr>${cM[0].flavor}<hr>${cM[1].flavor}`;
    }
    if ( dos1 === 3 || dos2 === 3 || dos3 == 3 || dos4 == 3 || dos5 == 3 || dos6 == 3) {
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
                } else {
                    toJoinVAlues.push(sv);
                    continue;
                }
            }
            rolls.unshift(await new DamageRoll(`{${toJoinVAlues.join(" ")}}`).evaluate( {async: true} ));
        }
    }
    if ( cM.length === 0) {
    } else if ( cM.length === 1) {
        options = cM[0].flags.pf2e.context.options;
    } else {
        /* this might have to be optimized for more cM, but it proves to be an empty array so far */
        options = [...new Set(cM[0].flags.pf2e.context.options.concat(cM[1].flags.pf2e.context.options))];
    }
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
