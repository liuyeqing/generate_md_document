const fs = require('fs');
const path = require('path');

function getAllVueFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // 递归处理子文件夹
            fileList = getAllVueFiles(filePath, fileList);
        } else if (path.extname(filePath) === '.vue') {
            // 筛选出扩展名为.vue的文件
            fileList.push(filePath);
        }
    });

    return fileList;
}

// 指定文件夹路径
const folderPath = './element';
// 调用函数获取所有的Vue文件
const vueFiles = getAllVueFiles(folderPath);


const compiler = require('vue-template-compiler');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const acorn = require('acorn');

vueFiles.forEach(file => {
    createMd(file)
})
function createMd(file) {
    // 读取Vue文件的源码
    const fileContent = fs.readFileSync(file, 'utf-8');

// 解析Vue文件
    const parsed = compiler.parseComponent(fileContent);

// 获取script标签部分
    const scriptContent = parsed.script.content;

    // 解析<script>标签内的代码，提取export default部分
    const acornAst = acorn.parse(scriptContent, { sourceType: 'module' });
    const exportDefault = acornAst.body.find(node => node.type === 'ExportDefaultDeclaration');
    exportDefault.declaration.properties.forEach(prop => {
        const wrapProp = prop
        if(prop.key.name === 'name') {
            const comName = prop.value.value
            const templateContent = parsed.template.content;

            const slotsRegex = /<slot[^>]*>/g;
            const slotsMatches = templateContent.match(slotsRegex);
            const slots = slotsMatches ? slotsMatches.map(slot => slot.replace('<slot', '').replace('>', '').trim()) : [];
            const initSlots = ['|slot', '|:--:']
            const parseSlots = slots.map(slot => {//解析，把空字符串转为default，并且提取数组项的name属性
                if(!slot.includes('name')) {
                    return '|default'
                } else {
                    const regex = /name="([^"]*)"/;
                    const matches = slot.match(regex);

                    if (matches && matches.length > 1) {
                        const attributeName = matches[1];
                        return `|${attributeName}`
                    }
                }
            })
            const resultSlots = initSlots.concat(parseSlots)

// 使用@babel/parser解析script的内容
            const ast = parser.parse(scriptContent, {
                sourceType: 'module',
                plugins: ['jsx'],
                tokens: true,
                comments: true
            });
            const comments = ast.comments;


// 存储prop的结果
            const props = ['|参数名|type|默认值|说明', '|:--:|:--:|:--:|:--:'];

// 存储methods的结果
            const methods = ['|method|说明', '|:--:|:--:'];

// 遍历AST，根据prop的定义提取相关信息
            traverse(ast, {
                ExportDefaultDeclaration(path) {
                    const node = path.node.declaration;
                    if (node.type === 'ObjectExpression') {
                        node.properties.forEach(prop => {
                            if (prop.key.name === 'props' && prop.value.type === 'ObjectExpression') {
                                prop.value.properties.forEach(propItem => {
                                    const propItemStart = propItem.start
                                    const propItemEnd = propItem.end
                                    // 如果有name，说明是直接设置prop type的；如果没有name，就遍历propItem.value.properties，找到.key.name为type的属性值，拿到type值，再拿到默认值
                                    let tmp = ''
                                    if(propItem.value.name) {
                                        tmp += `|${propItem.key.name}|${propItem.value.name}|${'无默认值'}`
                                    } else {
                                        propItem.value.properties.forEach(prop => {
                                            if(prop.key.name === 'type') {
                                                tmp += `|${propItem.key.name}|${prop.value.name}`
                                            }
                                            if(prop.key.name === 'default') {
                                                if(prop && prop.value && prop.value.value) {
                                                    tmp += `|${prop.value.value}`
                                                } else {
                                                    tmp += `|${'无默认值'}`
                                                }
                                            }
                                        })
                                    }
                                    let tmpComment = ''
                                    comments.forEach(comment => {
                                        const startLine = comment.start
                                        if((startLine >= propItemStart) && (startLine <= propItemEnd)) {
                                            tmpComment += `|${comment.value}`
                                        }
                                    });
                                    if(tmpComment === '') {
                                        tmp += `|${'暂无说明'}`
                                    } else {
                                        tmp += tmpComment
                                    }
                                    props.push(tmp)
                                });
                            }
                            if (prop.key.name === 'methods') {
                                prop.value.properties.forEach(sonProp => {
                                    const sonPropStart = sonProp.start
                                    const sonPropEnd = sonProp.end
                                    let des = ''
                                    comments.forEach(comment => {
                                        const startLine = comment.start
                                        if((startLine >= sonPropStart) && (startLine <= sonPropEnd)) {
                                            des += `|${comment.value}`
                                        }
                                    });
                                    if(des) {
                                        methods.push(`|${sonProp.key.name}${des}`)
                                    } else {
                                        methods.push(`|${sonProp.key.name}|${'暂无说明'}`)
                                    }
                                })
                            }
                        });
                    }
                }
            });

// 将props写入Markdown文件
            const markdownContent = `# Props\n\n${props.map(prop => `${prop}`).join('\n')}` + `\n\n# Methods\n\n${methods.map(method => `${method}`).join('\n')}` + `\n\n# Slots\n\n${resultSlots.map(slot => `${slot}`).join('\n')}`;

            if(comName) {
                fs.writeFileSync(`./result/${comName}.md`, markdownContent);
            } else {
                fs.writeFileSync(`./result/${file}.md`, markdownContent);
            }
        } else if(prop.key.name === 'componentName') {
            const comName = prop.value.value
            const templateContent = parsed.template.content;

            const slotsRegex = /<slot[^>]*>/g;
            const slotsMatches = templateContent.match(slotsRegex);
            const slots = slotsMatches ? slotsMatches.map(slot => slot.replace('<slot', '').replace('>', '').trim()) : [];
            const initSlots = ['|slot', '|:--:']
            const parseSlots = slots.map(slot => {//解析，把空字符串转为default，并且提取数组项的name属性
                if(!slot.includes('name')) {
                    return '|default'
                } else {
                    const regex = /name="([^"]*)"/;
                    const matches = slot.match(regex);

                    if (matches && matches.length > 1) {
                        const attributeName = matches[1];
                        return `|${attributeName}`
                    }
                }
            })
            const resultSlots = initSlots.concat(parseSlots)

// 使用@babel/parser解析script的内容
            const ast = parser.parse(scriptContent, {
                sourceType: 'module',
                plugins: ['jsx'],
                tokens: true,
                comments: true
            });
            const comments = ast.comments;


// 存储prop的结果
            const props = ['|参数名|type|默认值|说明', '|:--:|:--:|:--:|:--:'];

// 存储methods的结果
            const methods = ['|method|说明', '|:--:|:--:'];

// 遍历AST，根据prop的定义提取相关信息
            traverse(ast, {
                ExportDefaultDeclaration(path) {
                    const node = path.node.declaration;
                    if (node.type === 'ObjectExpression') {
                        node.properties.forEach(prop => {
                            if (prop.key.name === 'props' && prop.value.type === 'ObjectExpression') {
                                prop.value.properties.forEach(propItem => {
                                    const propItemStart = propItem.start
                                    const propItemEnd = propItem.end
                                    // 如果有name，说明是直接设置prop type的；如果没有name，就遍历propItem.value.properties，找到.key.name为type的属性值，拿到type值，再拿到默认值
                                    let tmp = ''
                                    if(propItem.value.name) {
                                        tmp += `|${propItem.key.name}|${propItem.value.name}|${'无默认值'}`
                                    } else {
                                        propItem.value.properties.forEach(prop => {
                                            if(prop.key.name === 'type') {
                                                tmp += `|${propItem.key.name}|${prop.value.name}`
                                            }
                                            if(prop.key.name === 'default') {
                                                if(prop && prop.value && prop.value.value) {
                                                    tmp += `|${prop.value.value}`
                                                } else {
                                                    tmp += `|${'无默认值'}`
                                                }
                                            }
                                        })
                                    }
                                    let tmpComment = ''
                                    comments.forEach(comment => {
                                        const startLine = comment.start
                                        if((startLine >= propItemStart) && (startLine <= propItemEnd)) {
                                            tmpComment += `|${comment.value}`
                                        }
                                    });
                                    if(tmpComment === '') {
                                        tmp += `|${'暂无说明'}`
                                    } else {
                                        tmp += tmpComment
                                    }
                                    props.push(tmp)
                                });
                            }
                            if (prop.key.name === 'methods') {
                                prop.value.properties.forEach(sonProp => {
                                    const sonPropStart = sonProp.start
                                    const sonPropEnd = sonProp.end
                                    let des = ''
                                    comments.forEach(comment => {
                                        const startLine = comment.start
                                        if((startLine >= sonPropStart) && (startLine <= sonPropEnd)) {
                                            des += `|${comment.value}`
                                        }
                                    });
                                    if(des) {
                                        methods.push(`|${sonProp.key.name}${des}`)
                                    } else {
                                        methods.push(`|${sonProp.key.name}|${'暂无说明'}`)
                                    }
                                })
                            }
                        });
                    }
                }
            });

// 将props写入Markdown文件
            const markdownContent = `# Props\n\n${props.map(prop => `${prop}`).join('\n')}` + `\n\n# Methods\n\n${methods.map(method => `${method}`).join('\n')}` + `\n\n# Slots\n\n${resultSlots.map(slot => `${slot}`).join('\n')}`;

            if(comName) {
                fs.writeFileSync(`./result/${comName}.md`, markdownContent);
            } else {
                fs.writeFileSync(`./result/${file}.md`, markdownContent);
            }
        }
    })


}