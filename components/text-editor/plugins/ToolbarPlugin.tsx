/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
	$createParagraphNode,
	$getNodeByKey,
	$getSelection,
	$isElementNode,
	$isRangeSelection,
	$isRootOrShadowRoot,
	CAN_REDO_COMMAND,
	CAN_UNDO_COMMAND,
	COMMAND_PRIORITY_CRITICAL,
	DEPRECATED_$isGridSelection,
	ElementFormatType,
	FORMAT_ELEMENT_COMMAND,
	FORMAT_TEXT_COMMAND,
	INDENT_CONTENT_COMMAND,
	LexicalEditor,
	NodeKey,
	OUTDENT_CONTENT_COMMAND,
	REDO_COMMAND,
	SELECTION_CHANGE_COMMAND,
	UNDO_COMMAND,
} from 'lexical';
import {
	$createHeadingNode,
	$createQuoteNode,
	$isHeadingNode,
	HeadingTagType,
} from '@lexical/rich-text';
import {
	$getSelectionStyleValueForProperty,
	$isParentElementRTL,
	$patchStyleText,
	$setBlocksType,
	$wrapNodes,
} from '@lexical/selection';
import {
	$isListNode,
	INSERT_CHECK_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
	ListNode,
	REMOVE_LIST_COMMAND,
} from '@lexical/list';
import {
	$createCodeNode,
	$isCodeNode,
	CODE_LANGUAGE_FRIENDLY_NAME_MAP,
	CODE_LANGUAGE_MAP,
	getLanguageFriendlyName,
} from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
	$findMatchingParent,
	$getNearestNodeOfType,
	mergeRegister,
} from '@lexical/utils';
import TextEditorDropDown, { TextEditorDropDownItem } from '../ui/DropDown';
import { getSelectedNode } from '../utils/getSelectedNode';
import { sanitizeUrl } from '../utils/url';
import { createPortal } from 'react-dom';
import FloatingLinkEditor from '../ui/FloatingLinkEditor';
import { InsertImageDialog } from './ImagesPlugin';
import textEditorUseModal from '../hooks/UseModal';

// const supportedBlockTypes = new Set([
// 	'paragraph',
// 	'quote',
// 	'code',
// 	'h1',
// 	'h2',
// 	'ul',
// 	'ol',
// ]);

// --- --- UTILS CONST --- --- //
const blockTypeToBlockName: { [key: string]: string } = {
	bullet: 'Bulleted List',
	check: 'Check List',
	code: 'Code Block',
	h1: 'Heading 1',
	h2: 'Heading 2',
	h3: 'Heading 3',
	h4: 'Heading 4',
	h5: 'Heading 5',
	h6: 'Heading 6',
	number: 'Numbered List',
	paragraph: 'Normal',
	quote: 'Quote',
	ol: 'Numbered List',
	ul: 'Bulleted List',
};

const TEXT_ALIGN_OPTIONS: {
	[key: string]: { icon: string; name: string };
} = {
	center: {
		icon: 'center-align',
		name: 'Center Align',
	},
	justify: {
		icon: 'justify-align',
		name: 'Justify Align',
	},
	left: {
		icon: 'left-align',
		name: 'Left Align',
	},
	right: {
		icon: 'right-align',
		name: 'Right Align',
	},
};

const FONT_FAMILY_OPTIONS: [string, string][] = [
	['Arial', 'Arial'],
	['Courier New', 'Courier New'],
	['Georgia', 'Georgia'],
	['Times New Roman', 'Times New Roman'],
	['Trebuchet MS', 'Trebuchet MS'],
	['Verdana', 'Verdana'],
];

const FONT_SIZE_OPTIONS: [string, string][] = [
	['10px', '10px'],
	['11px', '11px'],
	['12px', '12px'],
	['13px', '13px'],
	['14px', '14px'],
	['15px', '15px'],
	['16px', '16px'],
	['17px', '17px'],
	['18px', '18px'],
	['19px', '19px'],
	['20px', '20px'],
];

// --- --- ELEMENTS FUNCTIONS helpers --- --- //
function Select({ onChange, className, options, value }: any): JSX.Element {
	return (
		<select className={className} onChange={onChange} value={value}>
			<option hidden={true} value="" />
			{options.map((option: any) => (
				<option key={option} value={option}>
					{option}
				</option>
			))}
		</select>
	);
}

function dropDownActiveClass(active: boolean): string {
	if (active) return 'active dropdown-item-active';
	else return '';
}

function getCodeLanguageOptions(): [string, string][] {
	const options: [string, string][] = [];

	for (const [lang, friendlyName] of Object.entries(
		CODE_LANGUAGE_FRIENDLY_NAME_MAP
	)) {
		options.push([lang, friendlyName]);
	}

	return options;
}

const CODE_LANGUAGE_OPTIONS = getCodeLanguageOptions();

// --- --- OPTION TOOLBAR ELEMENTS renderers --- --- //
// EDITOR block options
function BlockFormatDropDown({
	editor,
	blockType,
	disabled = false,
	toolbarRef,
	setShowBlockOptionsDropDown,
}: {
	blockType: keyof typeof blockTypeToBlockName;
	editor: LexicalEditor;
	disabled?: boolean;
	toolbarRef: any;
	setShowBlockOptionsDropDown: Dispatch<SetStateAction<boolean>>;
}): JSX.Element {
	const dropDownRef = useRef(null);

	useEffect(() => {
		const toolbar = toolbarRef.current;
		const dropDown = dropDownRef.current;

		if (toolbar !== null && dropDown !== null) {
			const { top, left } = toolbar.getBoundingClientRect();
			(dropDown as any).style.top = `${top + 40}px`;
			(dropDown as any).style.left = `${left}px`;
		}
	}, [dropDownRef, toolbarRef]);

	useEffect(() => {
		const dropDown = dropDownRef.current;
		const toolbar = toolbarRef.current;

		if (dropDown !== null && toolbar !== null) {
			const handle = (event: MouseEvent): any => {
				const target = event.target;

				if (!(dropDown as any).contains(target) && !toolbar.contains(target)) {
					setShowBlockOptionsDropDown(false);
				}
			};
			document.addEventListener('click', handle);

			return () => {
				document.removeEventListener('click', handle);
			};
		}
	}, [dropDownRef, setShowBlockOptionsDropDown, toolbarRef]);

	const formatParagraph = (): void => {
		if (blockType !== 'paragraph') {
			editor.update(() => {
				const selection = $getSelection();

				if (
					$isRangeSelection(selection) ||
					DEPRECATED_$isGridSelection(selection)
				) {
					$setBlocksType(selection, () => $createParagraphNode());
				}
			});
		}
		setShowBlockOptionsDropDown(false);
	};

	const formatHeading = (headingSize: HeadingTagType): void => {
		if (blockType !== headingSize) {
			editor.update(() => {
				const selection = $getSelection();
				if (
					$isRangeSelection(selection) ||
					DEPRECATED_$isGridSelection(selection)
				) {
					$setBlocksType(selection, () => $createHeadingNode(headingSize));
				}
			});
		}
	};

	const formatBulletList = () => {
		// (blockType !== "ul")
		if (blockType !== 'bullet') {
			editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
		} else {
			editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
		}
		setShowBlockOptionsDropDown(false);
	};

	const formatCheckList = (): void => {
		if (blockType !== 'check') {
			editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
		} else {
			editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
		}
		setShowBlockOptionsDropDown(false);
	};

	const formatNumberedList = (): void => {
		// (blockType !== "ol")
		if (blockType !== 'number') {
			editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
		} else {
			editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
		}
		setShowBlockOptionsDropDown(false);
	};

	const formatQuote = (): void => {
		if (blockType !== 'quote') {
			editor.update(() => {
				const selection = $getSelection();
				if (
					$isRangeSelection(selection) ||
					DEPRECATED_$isGridSelection(selection)
				) {
					$setBlocksType(selection, () => $createQuoteNode());
				}
			});
		}
		setShowBlockOptionsDropDown(false);
	};

	const formatCode = (): void => {
		if (blockType !== 'code') {
			editor.update(() => {
				let selection = $getSelection();

				if (
					$isRangeSelection(selection) ||
					DEPRECATED_$isGridSelection(selection)
				) {
					if (selection.isCollapsed()) {
						$setBlocksType(selection, () => $createCodeNode());
					} else {
						const textContent = selection.getTextContent();
						const codeNode = $createCodeNode();
						selection.insertNodes([codeNode]);
						selection = $getSelection();
						if ($isRangeSelection(selection))
							selection.insertRawText(textContent);
					}
				}
			});
		}
		setShowBlockOptionsDropDown(false);
	};

	return (
		<TextEditorDropDown
			disabled={disabled}
			buttonClassName="toolbar-item block-controls"
			buttonIconClassName={'icon block-type ' + blockType}
			buttonLabel={blockTypeToBlockName[blockType]}
			buttonAriaLabel="Formatting options for text style"
		>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'paragraph')}
				onClick={formatParagraph}
			>
				<i className="icon paragraph" />
				<span className="text">Normal</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'h1')}
				onClick={() => formatHeading('h1')}
			>
				<i className="icon h1" />
				<span className="text">Heading 1</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'h2')}
				onClick={() => formatHeading('h2')}
			>
				<i className="icon h2" />
				<span className="text">Heading 2</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'h3')}
				onClick={() => formatHeading('h3')}
			>
				<i className="icon h3" />
				<span className="text">Heading 3</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'bullet')}
				onClick={formatBulletList}
			>
				<i className="icon bullet-list" />
				<span className="text">Bullet List</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'number')}
				onClick={formatNumberedList}
			>
				<i className="icon numbered-list" />
				<span className="text">Numbered List</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'check')}
				onClick={formatCheckList}
			>
				<i className="icon check-list" />
				<span className="text">Check list</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'quote')}
				onClick={formatQuote}
			>
				<i className="icon quote" />
				<span className="text">Quote</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				className={'item ' + dropDownActiveClass(blockType === 'code')}
				onClick={formatCode}
			>
				<i className="icon code" />
				<span className="text">Code Block</span>
			</TextEditorDropDownItem>
		</TextEditorDropDown>
	);
}

// FONT options
function FontDropDown({
	editor,
	value,
	style,
	disabled = false,
}: {
	editor: LexicalEditor;
	value: string;
	style: string;
	disabled?: boolean;
}): JSX.Element {
	const handleClick = useCallback(
		(option: string) => {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					$patchStyleText(selection, {
						[style]: option,
					});
				}
			});
		},
		[editor, style]
	);

	const buttonAriaLabel =
		style === 'font-family'
			? 'Formatting options for font family'
			: 'Formatting options for font size';

	return (
		<TextEditorDropDown
			disabled={disabled}
			buttonClassName={'toolbar-item ' + style}
			buttonLabel={value}
			buttonIconClassName={
				style === 'font-family' ? 'icon block-type font-family' : ''
			}
			buttonAriaLabel={buttonAriaLabel}
		>
			{(style === 'font-family' ? FONT_FAMILY_OPTIONS : FONT_SIZE_OPTIONS).map(
				([option, text]) => (
					<TextEditorDropDownItem
						className={`item ${dropDownActiveClass(value === option)} ${
							style === 'font-size' ? 'fontsize-item' : ''
						}`}
						onClick={() => handleClick(option)}
						key={option}
					>
						<span className="text">{text}</span>
					</TextEditorDropDownItem>
				)
			)}
		</TextEditorDropDown>
	);
}

// ALIGN options
function TextAlignDropDown({
	editor,
	value,
	isRTL,
	disabled = false,
}: {
	editor: LexicalEditor;
	value: ElementFormatType;
	isRTL: boolean;
	disabled: boolean;
}): JSX.Element {
	return (
		<TextEditorDropDown
			disabled={disabled}
			buttonLabel={TEXT_ALIGN_OPTIONS[value].name}
			buttonIconClassName={`icon ${TEXT_ALIGN_OPTIONS[value].icon}`}
			buttonClassName="toolbar-item spaced alignment"
			buttonAriaLabel="Formatting options for text alignment"
		>
			<TextEditorDropDownItem
				onClick={() => {
					editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
				}}
				className="item"
			>
				<i className="icon left-align" />
				<span className="text">Left Align</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				onClick={() => {
					editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
				}}
				className="item"
			>
				<i className="icon center-align" />
				<span className="text">Center Align</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				onClick={() => {
					editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
				}}
				className="item"
			>
				<i className="icon right-align" />
				<span className="text">Right Align</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				onClick={() => {
					editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
				}}
				className="item"
			>
				<i className="icon justify-align" />
				<span className="text">Justify Align</span>
			</TextEditorDropDownItem>
			<Divider />
			<TextEditorDropDownItem
				onClick={() => {
					editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
				}}
				className="item"
			>
				<i className={'icon ' + (isRTL ? 'indent' : 'outdent')} />
				<span className="text">Outdent</span>
			</TextEditorDropDownItem>
			<TextEditorDropDownItem
				onClick={() => {
					editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
				}}
				className="item"
			>
				<i className={'icon ' + (isRTL ? 'outdent' : 'indent')} />
				<span className="text">Indent</span>
			</TextEditorDropDownItem>
		</TextEditorDropDown>
	);
}

// DIVIDER element
function Divider(): JSX.Element {
	return <div className="divider" />;
}

export default function ToolbarPlugin(): JSX.Element {
	// --- --- utils
	const [editor] = useLexicalComposerContext();
	const [activeEditor, setActiveEditor] = useState(editor);
	const [isEditable, setIsEditable] = useState(() => editor.isEditable());

	const IS_APPLE = false;
	const [selectedElementKey, setSelectedElementKey] = useState<NodeKey | null>(
		null
	);
	const toolbarRef = useRef(null);
	const [showBlockOptionsDropDown, setShowBlockOptionsDropDown] =
		useState(false);
	const [modal, showModal] = textEditorUseModal();

	// --- --- Values helper variables --- --- //
	const [blockType, setBlockType] =
		useState<keyof typeof blockTypeToBlockName>('paragraph');
	const [fontSize, setFontSize] = useState<string>('15px');
	const [fontColor, setFontColor] = useState<string>('#000');
	const [bgColor, setBgColor] = useState<string>('#fff');
	const [fontFamily, setFontFamily] = useState<string>('Arial');
	const [elementFormat, setElementFormat] = useState<ElementFormatType>('left');
	const [isLink, setIsLink] = useState(false);
	const [isBold, setIsBold] = useState(false);
	const [isItalic, setIsItalic] = useState(false);
	const [isUnderline, setIsUnderline] = useState(false);
	const [isStrikethrough, setIsStrikethrough] = useState(false);
	const [isSubscript, setIsSubscript] = useState(false);
	const [isSuperscript, setIsSuperscript] = useState(false);
	const [isCode, setIsCode] = useState(false);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);
	const [isRTL, setIsRTL] = useState(false);
	const [codeLanguage, setCodeLanguage] = useState<string>('');

	const updateToolbar = useCallback(() => {
		const selection = $getSelection();
		if ($isRangeSelection(selection)) {
			const anchorNode = selection.anchor.getNode();
			let element =
				anchorNode.getKey() === 'root'
					? anchorNode
					: $findMatchingParent(anchorNode, (e) => {
							const parent = e.getParent();
							return parent !== null && $isRootOrShadowRoot(parent);
					  });

			if (element === null) {
				element = anchorNode.getTopLevelElementOrThrow();
			}

			const elementKey = element.getKey();
			const elementDOM = activeEditor.getElementByKey(elementKey);

			if (elementDOM !== null) {
				setSelectedElementKey(elementKey);
				if ($isListNode(element)) {
					const parentList = $getNearestNodeOfType<ListNode>(
						anchorNode,
						ListNode
					);
					const type = parentList
						? parentList.getListType()
						: element.getListType();
					setBlockType(type);
				} else {
					const type = $isHeadingNode(element)
						? element.getTag()
						: element.getType();
					if (type in blockTypeToBlockName) {
						setBlockType(type as keyof typeof blockTypeToBlockName);
					}
					if ($isCodeNode(element)) {
						const language =
							element.getLanguage() as keyof typeof CODE_LANGUAGE_MAP;
						setCodeLanguage(
							language ? CODE_LANGUAGE_MAP[language] || language : ''
						);
						return;
					}
				}
			}
			// Update text format
			setIsBold(selection.hasFormat('bold'));
			setIsItalic(selection.hasFormat('italic'));
			setIsUnderline(selection.hasFormat('underline'));
			setIsStrikethrough(selection.hasFormat('strikethrough'));
			setIsSubscript(selection.hasFormat('subscript'));
			setIsSuperscript(selection.hasFormat('superscript'));
			setIsCode(selection.hasFormat('code'));
			setIsRTL($isParentElementRTL(selection));

			// Update links
			const node = getSelectedNode(selection);
			const parent = node.getParent();
			if ($isLinkNode(parent) || $isLinkNode(node)) {
				setIsLink(true);
			} else {
				setIsLink(false);
			}

			// Handle buttons
			setFontSize(
				$getSelectionStyleValueForProperty(selection, 'font-size', '15px')
			);
			setFontColor(
				$getSelectionStyleValueForProperty(selection, 'color', '#000')
			);
			setBgColor(
				$getSelectionStyleValueForProperty(
					selection,
					'background-color',
					'#fff'
				)
			);
			setFontFamily(
				$getSelectionStyleValueForProperty(selection, 'font-family', 'Arial')
			);
			setElementFormat(
				($isElementNode(node)
					? node.getFormatType()
					: parent?.getFormatType()) || 'left'
			);
		}
	}, [activeEditor]);

	useEffect(() => {
		return editor.registerCommand(
			SELECTION_CHANGE_COMMAND,
			(_payload, newEditor) => {
				updateToolbar();
				setActiveEditor(newEditor);
				return false;
			},
			COMMAND_PRIORITY_CRITICAL
		);
	}, [editor, updateToolbar]);

	useEffect(() => {
		return mergeRegister(
			editor.registerEditableListener((editable) => {
				setIsEditable(editable);
			}),
			activeEditor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => {
					updateToolbar();
				});
			}),
			activeEditor.registerCommand<boolean>(
				CAN_UNDO_COMMAND,
				(payload) => {
					setCanUndo(payload);
					return false;
				},
				COMMAND_PRIORITY_CRITICAL
			),
			activeEditor.registerCommand<boolean>(
				CAN_REDO_COMMAND,
				(payload) => {
					setCanRedo(payload);
					return false;
				},
				COMMAND_PRIORITY_CRITICAL
			)
		);
	}, [activeEditor, editor, updateToolbar]);

	const onCodeLanguageSelect = useCallback(
		(value: string) => {
			activeEditor.update(() => {
				if (selectedElementKey !== null) {
					const node = $getNodeByKey(selectedElementKey);
					if ($isCodeNode(node)) {
						node.setLanguage(value);
					}
				}
			});
		},
		[activeEditor, selectedElementKey]
	);

	const insertLink = useCallback(() => {
		if (!isLink) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeUrl('https://'));
		} else {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
		}
	}, [editor, isLink]);

	return (
		<div className="toolbar" ref={toolbarRef}>
			{/* BUTTONS */}
			{/* UNDO  */}
			<button
				disabled={!canUndo || !isEditable}
				onClick={() => {
					activeEditor.dispatchCommand(UNDO_COMMAND, undefined);
				}}
				title={IS_APPLE ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)'}
				type="button"
				className="toolbar-item spaced"
				aria-label="Undo"
			>
				<i className="format undo" />
			</button>
			{/* REDO */}
			<button
				disabled={!canRedo || !isEditable}
				onClick={() => {
					activeEditor.dispatchCommand(REDO_COMMAND, undefined);
				}}
				title={IS_APPLE ? 'Redo (⌘Y)' : 'Redo (Ctrl+Y)'}
				type="button"
				className="toolbar-item"
				aria-label="Redo"
			>
				<i className="format redo" />
			</button>
			<Divider />

			{/* SELECT - DROPDOWN BLOCK TYPE OPTIONS */}
			{blockType in blockTypeToBlockName && activeEditor === editor && (
				<>
					<BlockFormatDropDown
						disabled={!isEditable}
						blockType={blockType}
						editor={editor}
						toolbarRef={toolbarRef}
						setShowBlockOptionsDropDown={setShowBlockOptionsDropDown}
					/>
					<Divider />
				</>
			)}

			{/* Show available coding languages */}
			{blockType === 'code' && (
				<>
					<TextEditorDropDown
						disabled={!isEditable}
						buttonClassName="toolbar-item code-language"
						buttonLabel={getLanguageFriendlyName(codeLanguage)}
						buttonAriaLabel="Select language"
					>
						{CODE_LANGUAGE_OPTIONS.map(([value, name]) => {
							return (
								<TextEditorDropDownItem
									className={`item ${dropDownActiveClass(
										value === codeLanguage
									)}`}
									onClick={() => onCodeLanguageSelect(value)}
									key={value}
								>
									<span className="text">{name}</span>
								</TextEditorDropDownItem>
							);
						})}
					</TextEditorDropDown>
				</>
			)}

			{/* Show normal edition options */}
			{blockType !== 'code' && (
				<>
					<FontDropDown
						disabled={!isEditable}
						style={'font-family'}
						value={fontFamily}
						editor={editor}
					/>
					<FontDropDown
						disabled={!isEditable}
						style={'font-size'}
						value={fontSize}
						editor={editor}
					/>
					<button
						disabled={!isEditable}
						onClick={() => {
							activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
						}}
						className={'toolbar-item spaced ' + (isBold ? 'active' : '')}
						title={IS_APPLE ? 'Bold (⌘B)' : 'Bold (Ctrl+B)'}
						type="button"
						aria-label={`Format text as bold. Shortcut: ${
							IS_APPLE ? '⌘B' : 'Ctrl+B'
						}`}
					>
						<i className="format bold" />
					</button>
					<button
						disabled={!isEditable}
						onClick={() => {
							activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
						}}
						className={'toolbar-item spaced ' + (isItalic ? 'active' : '')}
						title={IS_APPLE ? 'Italic (⌘I)' : 'Italic (Ctrl+I)'}
						type="button"
						aria-label={`Format text as italics. Shortcut: ${
							IS_APPLE ? '⌘I' : 'Ctrl+I'
						}`}
					>
						<i className="format italic" />
					</button>
					<button
						disabled={!isEditable}
						onClick={() => {
							activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
						}}
						className={'toolbar-item spaced ' + (isUnderline ? 'active' : '')}
						title={IS_APPLE ? 'Underline (⌘U)' : 'Underline (Ctrl+U)'}
						type="button"
						aria-label={`Format text to underlined. Shortcut: ${
							IS_APPLE ? '⌘U' : 'Ctrl+U'
						}`}
					>
						<i className="format underline" />
					</button>
					<button
						disabled={!isEditable}
						onClick={insertLink}
						className={'toolbar-item spaced ' + (isLink ? 'active' : '')}
						aria-label="Insert link"
						title="Insert link"
						type="button"
					>
						<i className="format link" />
					</button>
					<button
						onClick={() => {
							showModal('Insert Image', (onClose: () => void) => (
								<InsertImageDialog
									activeEditor={activeEditor}
									onClose={onClose}
								/>
							));
						}}
						className={'toolbar-item spaced'}
						aria-label="Insert image"
						title="Insert image"
						type="button"
					>
						<i className="format insert-image" />
					</button>
					{isLink &&
						createPortal(<FloatingLinkEditor editor={editor} />, document.body)}
					<Divider />

					<TextAlignDropDown
						disabled={!isEditable}
						value={elementFormat}
						editor={editor}
						isRTL={isRTL}
					/>

					{modal}
				</>
			)}
		</div>
	);
}