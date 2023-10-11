import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import Link from 'next/link';
import { Typography } from '../typography';
import { Option } from 'interfaces';
import {
	itemIsNotNullAndNotUndefined,
	itemIsNullOrUndefined,
} from 'utils/common';
import { Icon } from '../icon';

export interface DropdownProps {
	buttonContent: string | JSX.Element;
	showChevronDownIcon?: boolean;
	items?: Option[];
	customItems?: JSX.Element;

	// Styles
	classNameButton?: string;
	classNameMenuItems?: string;
	classNameItem?: string;
}

export const Dropdown = ({
	showChevronDownIcon = true,
	classNameButton = 'w-auto rounded-md p-1 bg-stone-200 hover:bg-gray-300',
	classNameMenuItems = 'w-max bg-white rounded-lg hover:bg-dark-10',
	classNameItem = 'text-gray-800 hover:text-white font-bold text-sm',
	...props
}: DropdownProps): JSX.Element => {
	return (
		<Menu as="div" className="relative">
			<Menu.Button
				className={clsx(
					'flex justify-center align-center',
					'focus:outline-none relative z-0',
					'focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-opacity-75',
					classNameButton
				)}
			>
				{props.buttonContent}
				{showChevronDownIcon && (
					<ChevronDownIcon
						className="ml-2 -mr-1 h-5 w-5 text-gray-500 hover:text-gray-700"
						aria-hidden="true"
					/>
				)}
			</Menu.Button>

			<Transition
				as={Fragment}
				enter="transition ease-out duration-100"
				enterFrom="transform opacity-0 scale-95"
				enterTo="transform opacity-100 scale-100"
				leave="transition ease-in duration-75"
				leaveFrom="transform opacity-100 scale-100"
				leaveTo="transform opacity-0 scale-95"
			>
				<Menu.Items
					className={clsx(
						'absolute right-0 mt-1 z-50',
						'origin-top-right shadow-lg',
						'focus:outline-none',
						classNameMenuItems
					)}
				>
					{props.customItems != undefined && props.customItems != null && (
						<>{props.customItems}</>
					)}
					{(props.customItems == undefined || props.customItems == null) &&
						props.items?.map((item, index) => {
							return (
								<Menu.Item key={`dropDown-option-${item.label}-${index}`}>
									<div className="cursor-pointer">
										{item.icon && <Icon src={item.icon} className="w-4 h-4" />}

										{item.href && itemIsNullOrUndefined(item.onClick) && (
											<Link href={item.href}>
												<Typography
													type="custom-p"
													className={clsx('cursor-pointer p-2', classNameItem)}
												>
													{item.label}
												</Typography>
											</Link>
										)}

										{itemIsNotNullAndNotUndefined(item.onClick) &&
											itemIsNullOrUndefined(item.href) && (
												<button
													className={clsx('cursor-pointer p-2', classNameItem)}
													onClick={item.onClick}
												>
													{item.label}
												</button>
											)}
									</div>
								</Menu.Item>
							);
						})}
				</Menu.Items>
			</Transition>
		</Menu>
	);
};